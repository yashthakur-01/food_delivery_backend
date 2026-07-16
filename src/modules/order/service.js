'use strict';

const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');
const ORDER_STATUS = require('../../common/constants/orderStatus');
const notificationService = require('../notification/service');
const REQUEST_STATUS = require('../../common/constants/OrderRequest');
const REQUEST_TYPE = require("../../common/constants/requestType");
const { deductStock, restoreStockForOrder } = require('../../common/utils/stockUtils');

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
 * Create a new order for a customer.
 * Supports both restaurants and grocery stores by validating items against the respective store.
 *
 * @param {string} customerId - The ID of the customer placing the order.
 * @param {Object} payload - The order payload.
 * @param {string} payload.store_id - The ID of the store or restaurant.
 * @param {string} [payload.address_id] - The ID of the saved address to deliver to.
 * @param {Array} payload.items - Array of items to order [{ item_id, quantity }].
 * @param {string} payload.store_type - The type of store ('restaurant' or 'grocery').
 * @param {Object} [additionalData=null] - Optional additional data for address or free replacement overrides.
 * @returns {Promise<Object>} The newly created order record.
 * @throws {AppError} If the address is invalid or items do not belong to the store.
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

  // Grocery stock & availability validation
if (store_type === "grocery") {
  const productMap = Object.fromEntries(
    menuItems.map(product => [product.id, product])
  );

  for (const item of items) {
    const product = productMap[item.item_id];

    if (!product.isAvailable) {
      throw new AppError(
        400,
        "PRODUCT_UNAVAILABLE",
        `${product.name} is currently unavailable`
      );
    }

    if (item.quantity > product.stock) {
      throw new AppError(
        400,
        "INSUFFICIENT_STOCK",
        `Only ${product.stock} unit(s) of ${product.name} are available`
      );
    }
  }
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

  // ── Stock deduction (grocery orders only) ─────────────────────────────────
  // Atomically decrement stock and soldCount for each grocery product.
  // auto-toggles isAvailable to false if stock reaches 0.
  if (store_type === 'grocery') {
    await deductStock(prisma, items);
  }

  return order;
}

/**
 * Cancel an order. 
 * Can only be cancelled if the order is currently in a PENDING or CONFIRMED status.
 *
 * @param {string} orderId - The ID of the order to cancel.
 * @param {string} customerId - The ID of the customer who owns the order.
 * @returns {Promise<Object>} The updated order record.
 * @throws {AppError} 404 if not found, 403 if unauthorized, 400 if the order is in an uncancellable state.
 */
async function cancelOrder(orderId, customerId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (order.userId !== customerId) throw new AppError(403, 'FORBIDDEN', 'You do not own this order');

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new AppError(400, 'INVALID_STATUS', `Order cannot be cancelled in status: ${order.status}`);
  }

  // ── Stock restoration (grocery orders only) ───────────────────────────────
  // Restore stock for every grocery product in this order before cancelling.
  // Also re-enables isAvailable for products that were auto-disabled.
  if (order.storeId) {
    await restoreStockForOrder(prisma, orderId);
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: ORDER_STATUS.CANCELLED },
  });
}

/**
 * Retrieve a paginated list of orders for a specific customer.
 * Can be filtered by active/past tabs and the type of store (restaurant/grocery).
 *
 * @param {string} customerId - The ID of the customer.
 * @param {Object} options - Query options.
 * @param {number} [options.page=1] - The page number for pagination.
 * @param {number} [options.limit=20] - The number of records per page.
 * @param {string} [options.tab] - Filter by 'active' or 'past' statuses.
 * @param {string} [options.type] - Filter by store type ('restaurant' or 'grocery') to include specific relation details.
 * @returns {Promise<Object>} An object containing the orders array, total count, page, and limit.
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
 * Safely update the status of an order using strict state machine validation.
 * Automatically broadcasts socket events to relevant parties (customers, delivery agents).
 *
 * @param {string} orderId - The ID of the order to update.
 * @param {string} newStatus - The new status to transition to.
 * @param {Object} [io] - The Socket.io instance for emitting real-time events.
 * @returns {Promise<Object>} The updated order record.
 * @throws {AppError} 404 if not found, 400 if the transition is invalid based on VALID_TRANSITIONS.
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

/**
 * Submit a refund or replacement request for a delivered order.
 * Validates the items against the store and sends notifications/socket events to the store owner.
 *
 * @param {string} orderId - The ID of the order being disputed.
 * @param {string} customerId - The ID of the customer making the request.
 * @param {Object} payload - The request details.
 * @param {string} payload.type - The type of request ('refund' or 'replacement').
 * @param {string} payload.store_type - The type of store ('restaurant' or 'grocery').
 * @param {string} payload.reason - The reason for the request.
 * @param {string} [payload.image_url] - Optional proof image URL.
 * @param {Array} payload.items - Array of items to request action on [{ item_id, quantity }].
 * @param {Object} [io] - The Socket.io instance for emitting real-time events to the seller.
 * @returns {Promise<Object>} The newly created order request record.
 * @throws {AppError} 400 if the store is closed, items are invalid, or the order isn't delivered yet.
 */
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
      newItems: replaceOrderItems,
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
