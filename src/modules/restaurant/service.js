'use strict';

const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');
const orderService = require('../order/service');
const paymentService = require('../payment/service');
const REQUEST_STATUS = require("../../common/constants/OrderRequest")
const REQUEST_TYPE = require("../../common/constants/requestType")

/** List restaurants with optional category filter and pagination. */
async function listRestaurants({ page = 1, limit = 20, category } = {}) {
  const skip = (page - 1) * limit;
  const where = { approvalStatus: 'approved' };
  if (category) where.category = { equals: category, mode: 'insensitive' };

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      where, skip, take: limit,
      orderBy: { isFeatured: 'desc' },
      select: {
        id: true, name: true, description: true, cuisineType: true, category: true,
        imageUrl: true, rating: true, ratingCount: true, deliveryTimeMin: true,
        deliveryTimMax: true, deliveryFee: true, minOrderAmount: true,
        isOpen: true, offerTag: true, latitude: true, longitude: true,
      },
    }),
    prisma.restaurant.count({ where }),
  ]);
  return { restaurants, total, page, limit };
}

/** Search restaurants and menu items by query string. Saves to search history if userId provided. */
async function searchRestaurants(query, userId, { page = 1, limit = 20 } = {}) {
  if (!query || query.trim().length === 0) throw new AppError(400, 'BAD_REQUEST', 'Search query is required');

  const skip = (page - 1) * limit;
  const q = query.trim();

  // Save to search history
  if (userId) {
    // Avoid duplicate recent entries — delete old one first
    await prisma.searchHistory.deleteMany({ where: { userId, query: q } });
    await prisma.searchHistory.create({ data: { userId, query: q } });
  }

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      where: {
        approvalStatus: 'approved',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { cuisineType: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { menuItems: { some: { name: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      skip, take: limit,
      select: {
        id: true, name: true, cuisineType: true, imageUrl: true,
        rating: true, ratingCount: true, deliveryTimeMin: true,
        deliveryFee: true, isOpen: true, offerTag: true,
      },
    }),
    prisma.restaurant.count({
      where: {
        approvalStatus: 'approved',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { cuisineType: { contains: q, mode: 'insensitive' } },
          { menuItems: { some: { name: { contains: q, mode: 'insensitive' } } } },
        ],
      },
    }),
  ]);

  return { restaurants, total, page, limit, query: q };
}

/** Get recent search history for a user. */
async function getSearchHistory(userId, limit = 10) {
  return prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/** Delete a single search history entry. */
async function deleteSearchEntry(userId, searchId) {
  const entry = await prisma.searchHistory.findFirst({ where: { id: searchId, userId } });
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'Search entry not found');
  await prisma.searchHistory.delete({ where: { id: searchId } });
}

/** Clear all search history for a user. */
async function clearSearchHistory(userId) {
  await prisma.searchHistory.deleteMany({ where: { userId } });
}

/** Get all distinct restaurant categories. */
async function getCategories() {
  const results = await prisma.restaurant.findMany({
    where: { approvalStatus: 'approved', category: { not: null } },
    select: { category: true },
    distinct: ['category'],
  });
  return results.map((r) => r.category).filter(Boolean);
}

/** Get active banners for the home screen. */
async function getBanners() {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

/** Get a single restaurant with its menu grouped by category. */
async function getRestaurantDetails(restaurantId) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { menuItems: { where: { isAvailable: true }, orderBy: { category: 'asc' } } },
  });
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');

  const menu = restaurant.menuItems.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return { ...restaurant, menuItems: undefined, menu };
}

/** Add a menu item to a restaurant. */
async function addMenuItem(restaurantId, ownerId, data) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
  if (restaurant.ownerId !== ownerId) throw new AppError(403, 'FORBIDDEN', 'You do not own this restaurant');

  return prisma.menuItem.create({ data: { restaurantId, ...data } });
}

/** Update a menu item. */
async function updateMenuItem(restaurantId, itemId, ownerId, data) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
  if (restaurant.ownerId !== ownerId) throw new AppError(403, 'FORBIDDEN', 'You do not own this restaurant');

  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found');

  return prisma.menuItem.update({ where: { id: itemId }, data });
}


/** Get a replace order request by ID. */
async function getOrderRequest(replacementId, ownerId){
  const replacement = await prisma.orderRequest.findUnique({
    where:{ id: replacementId },
    include:{
      order:{
        include:{
          restaurant:true,
          user:{
            select:{ id:true, name:true, phone:true }
          }
        }
      }
    }
  });

  if(!replacement){
    throw new AppError(404, 'NOT_FOUND', 'Replacement request not found');
  }

  if(replacement.order.restaurant.ownerId !== ownerId){
    throw new AppError(403, 'FORBIDDEN', 'You cannot access this request');
  }

  return replacement;
}

async function updateOrderRequest(replacementId, ownerId, status){
  const replacement = await getOrderRequest(replacementId, ownerId);

  if(status === REQUEST_STATUS.ACCEPTED && replacement.type === REQUEST_TYPE.REPLACE){
    const newOrder = await orderService.createOrder(
      replacement.userId,
      {
        restaurant_id: replacement.order.restaurantId,
        items: replacement.newItems.map((item)=>({
          menu_item_id: item.menuItemId,
          quantity: item.quantity
        }))
      },{
        addressLine: replacement.order.deliveryAddress,
        latitude: replacement.order.deliveryLat,
        longitude: replacement.order.deliveryLng,
        freeReplacement:true
      }
    );

    await prisma.orderRequest.update({
      where:{ id: replacementId },
      data:{ status:REQUEST_STATUS.ACCEPTED }
    });

    return newOrder;
  }

  if(status === REQUEST_STATUS.ACCEPTED && replacement.type === REQUEST_TYPE.REFUND){
    await paymentService.processRefund(
      replacement.orderId,
      replacement.refundAmount
    );

    return prisma.orderRequest.update({
      where:{ id: replacementId },
      data:{ status: REQUEST_STATUS.ACCEPTED }
    });
  }

  if(status === REQUEST_STATUS.REJECTED){

    const notificationBody = {
      title: `${replacement.type} Request Rejected`,
      message: `Your ${replacement.type} request for order #${replacement.orderId} has been rejected by the restaurant. You can contact the restaurant at ${replacement.order.restaurant.phone} for more details`,
      type: "ORDER_REQUEST_REJECTED"
    }

    notificationService.sendNotification({
      userId: replacement.userId,
      ...notificationBody
    });

    const notification = await prisma.notification.create({
      data:{
        userId: replacement.userId,
        ...notificationBody,
        isRead:false
      }
    });

    return prisma.orderRequest.update({
      where:{ id: replacementId },
      data:{ status:REQUEST_STATUS.REJECTED }
    });
  }

  throw new AppError(400, 'INVALID_STATUS', 'Invalid order request status');
}

module.exports = {
  listRestaurants, searchRestaurants, getSearchHistory, deleteSearchEntry,
  clearSearchHistory, getCategories, getBanners, getRestaurantDetails,
  addMenuItem, updateMenuItem,
  getOrderRequest,
  updateOrderRequest,
};
