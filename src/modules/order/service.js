'use strict';

const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');
const ORDER_STATUS = require('../../common/constants/orderStatus');
const notificationService = require('../notification/service');
const REQUEST_STATUS = require('../../common/constants/OrderRequest');
const REQUEST_TYPE = require("../../common/constants/requestType")

const VALID_TRANSITIONS = {
  [ORDER_STATUS.PENDING]:          [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]:        [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]:        [ORDER_STATUS.OUT_FOR_DELIVERY],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]:        [],
  [ORDER_STATUS.CANCELLED]:        [],
};

const CANCELLABLE_STATUSES = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED];

/**
 * Create a new order.
 */
async function createOrder(customerId, { store_id, address_id, items, store_type }, additionalData = null) {
  const itemIds = items.map((i) => i.item_id);
  
  let address;
  if(address_id){
    address = await prisma.address.findUnique({ where: { id: address_id } });
    if(!address || address.userId !== customerId){
      throw new AppError(400, 'INVALID_ADDRESS', 'Address does not belong to the customer');
    }
  }

  if (!address && additionalData?.addressLine) {
    address = additionalData;
  }

  let menuItems;
  if(store_type=="restaurant"){
    menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, restaurantId: store_id },
    });
  }else if(store_type=="grocery"){
    menuItems = await prisma.groceryProduct.findMany({
      where: { id: { in: itemIds }, storeId: store_id },
    });
  }

  // Fetch all requested menu items that belong to the restaurant

  if (menuItems.length !== itemIds.length) {
    throw new AppError(400, 'INVALID_ITEMS', 'One or more items do not belong to the specified store');
  }

  const priceMap = Object.fromEntries(menuItems.map((m) => [m.id, m.price]));
  const total = additionalData?.freeReplacement ? 0 : items.reduce((sum, item) => sum + priceMap[item.item_id] * item.quantity, 0);

  const deliveryAddress = address.addressLine ?? `${address.line1} ${address.line2 ?? ''} ${address.city ?? ''} ${address.state ?? ''} ${address.pincode ?? ''}`;

  const orderBody = {
    userId: customerId,
    status: ORDER_STATUS.PENDING,
    totalAmount: total,
    deliveryAddress,
    deliveryLat: address.latitude,
    deliveryLng: address.longitude,
  }
  if (store_type == "restaurant") {
    orderBody.restaurantId = store_id;
  } else if (store_type == "grocery") {
    orderBody.storeId = store_id;
  }
  let itemList = {}
  if(store_type=="restaurant"){
    itemList = {
      create: items.map((item) => ({
        menuItemId: item.item_id,
        quantity: item.quantity,
        price: priceMap[item.item_id],
      }))
    }
  }else if(store_type=="grocery"){
    itemList = {
      create: items.map((item) => ({
        groceryProductId: item.item_id,
        quantity: item.quantity,
        price: priceMap[item.item_id],
      }))
    }
  }

  const order = await prisma.order.create({
    data: {...orderBody, items: itemList},
    include: { items: true },
  });

  return order;
}

/**
 * Cancel an order. Only allowed from PENDING or CONFIRMED statuses.
 */
async function cancelOrder(orderId, customerId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (order.userId !== customerId) throw new AppError(403, 'FORBIDDEN', 'You do not own this order');

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new AppError(400, 'INVALID_STATUS', `Order cannot be cancelled in status: ${order.status}`);
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: ORDER_STATUS.CANCELLED },
  });
}

/**
 * Get paginated orders scoped to the requesting customer.
 * tab: 'active' returns pending/confirmed/preparing/out_for_delivery
 * tab: 'past' returns delivered/cancelled
 */
async function getOrders(customerId, { page = 1, limit = 20, tab, type } = {}) {
  const skip = (page - 1) * limit;

  const ACTIVE_STATUSES = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING, ORDER_STATUS.OUT_FOR_DELIVERY];
  const PAST_STATUSES = [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED];

  const where = { userId: customerId };
  if (tab === 'active') where.status = { in: ACTIVE_STATUSES };
  else if (tab === 'past') where.status = { in: PAST_STATUSES };

  let orderBody = {}
  if(type=='restaurant'){
    orderBody.include = {
      items: { include: { menuItem: { select: { name: true, imageUrl: true } } } },
      restaurant: { select: { id: true, name: true, imageUrl: true } },
    }
  }else if(type=='grocery'){
    orderBody.include = {
      items: { include: { groceryProduct: { select: { name: true, imageUrl: true } } } },
      store: { select: { id: true, name: true, imageUrl: true } },
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      ...orderBody
    }),
    prisma.order.count({ where }),
  ]);
  return { orders, total, page, limit };
}

/**
 * Update order status with state machine validation.
 * Also emits socket events: order_status_update to customer, new_delivery_request to delivery_agents on CONFIRMED.
 */
async function updateOrderStatus(orderId, newStatus, io) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(400, 'INVALID_TRANSITION', `Cannot transition from ${order.status} to ${newStatus}`);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus },
  });

  if (io) {
    io.to(`user:${order.userId}`).emit('order_status_update', {
      order_id: orderId,
      status: newStatus,
    });

    // Broadcast to all delivery agents when order is confirmed and ready for pickup
    if (newStatus === ORDER_STATUS.CONFIRMED) {
      io.to('delivery_agents').emit('new_delivery_request', {
        order_id: orderId,
        status: newStatus,
      });
    }
  }

  return updated;
}

async function createOrderRequest(orderId, customerId, { type, store_type, reason, image_url, items }, io){
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });

  if(!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

  if(order.userId !== customerId){
    throw new AppError(403, 'FORBIDDEN', 'You do not own this order');
  }

  if(order.status !== ORDER_STATUS.DELIVERED){
    throw new AppError(400, 'INVALID_STATUS', 'Only delivered orders can have refund/replacement requests');
  }

  let ownerId;
  let sellerId;
  if (store_type === 'restaurant') {
    sellerId = order.restaurantId;
    const restaurant = await prisma.restaurant.findUnique({ where: { id: sellerId } });
    if(restaurant.isOpen === false) throw new AppError(400, 'RESTAURANT_CLOSED', 'Cannot create order request. The restaurant is closed');
    ownerId = restaurant.ownerId;
  } else if (store_type === 'grocery') {
    sellerId = order.storeId;
    const store = await prisma.store.findUnique({ where: { id: sellerId } });
    if(store.isOpen === false) throw new AppError(400, 'STORE_CLOSED', 'Cannot create order request. The store is closed');
    ownerId = store.ownerId;
  }

  const itemIds = items.map((item) => item.item_id);

  let sellerItems;
  if (store_type === 'restaurant') {
    sellerItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, restaurantId: sellerId }
    });
  } else if (store_type === 'grocery') {
    sellerItems = await prisma.groceryProduct.findMany({
      where: { id: { in: itemIds }, storeId: sellerId }
    });
  }

  if(sellerItems.length !== itemIds.length){
    throw new AppError(400, 'INVALID_ITEMS', 'Invalid request items');
  }

  const priceMap = Object.fromEntries(sellerItems.map((item) => [item.id, item.price]));

  const replaceOrderItems = items.map((item) => ({
    itemId: item.item_id,
    quantity: item.quantity,
    price: priceMap[item.item_id]
  }));

  const refundAmount = type === REQUEST_TYPE.REFUND
    ? replaceOrderItems.reduce((sum,item)=>sum+(item.price*item.quantity),0)
    : null;

  const replaceOrderRecord = await prisma.orderRequest.create({
    data: {
      orderId,
      userId: customerId,
      reason,
      imageUrl: image_url,
      oldItems: order.items,
      newItems: type === REQUEST_TYPE.REPLACE ? replaceOrderItems : null,
      refundAmount,
      status: REQUEST_STATUS.PENDING,
      type
    }
  });

  const notification = {
    title: 'New Order Request',
    message: `A new ${type} request has been made for order #${orderId}.`,
    type: 'order_request'
  }

  await notificationService.createNotification({...notification, userId: ownerId});

  await notificationService.sendPushNotification({...notification, userId: ownerId});

  if(io){
    io.to(`${store_type}:${sellerId}`).emit('order_request', {
      order_id: orderId,
      request_id: replaceOrderRecord.id,
      reason,
      image_url,
      items: replaceOrderItems
    });
  }

  return replaceOrderRecord;
}

module.exports = { createOrder, cancelOrder, getOrders, updateOrderStatus, createOrderRequest };
