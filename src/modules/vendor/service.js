'use strict';

const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING'];
const DELIVERED = 'DELIVERED';
const CONFIRMED = 'CONFIRMED';
const PREPARING = 'PREPARING';
const CANCELLED = 'CANCELLED';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function startOfWeek() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); return d;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOwnerRestaurant(ownerId) {
  const restaurant = await prisma.restaurant.findFirst({ where: { ownerId } });
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'No restaurant found for this owner');
  return restaurant;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function getDashboard(ownerId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const restaurantId = restaurant.id;

  const todayStart = startOfToday();
  const weekStart = startOfWeek();

  const [
    todayOrders,
    activeOrders,
    todayCompleted,
    totalCompleted,
    weeklyEarnings,
  ] = await Promise.all([
    prisma.order.count({ where: { restaurantId, createdAt: { gte: todayStart } } }),
    prisma.order.count({ where: { restaurantId, status: { in: ACTIVE_STATUSES } } }),
    prisma.order.findMany({
      where: { restaurantId, status: DELIVERED, updatedAt: { gte: todayStart } },
      select: { totalAmount: true },
    }),
    prisma.order.count({ where: { restaurantId, status: DELIVERED } }),
    // Weekly earnings per day (last 7 days)
    prisma.order.findMany({
      where: { restaurantId, status: DELIVERED, updatedAt: { gte: weekStart } },
      select: { totalAmount: true, updatedAt: true },
    }),
  ]);

  const todayEarnings = todayCompleted.reduce((s, o) => s + o.totalAmount, 0);
  const totalOrders = await prisma.order.count({ where: { restaurantId } });
  const completionRate = totalOrders > 0 ? Math.round((totalCompleted / totalOrders) * 100) : 0;

  // Build weekly chart data (Sun-Sat)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyChart = days.map((day, i) => {
    const dayEarnings = weeklyEarnings
      .filter((o) => new Date(o.updatedAt).getDay() === i)
      .reduce((s, o) => s + o.totalAmount, 0);
    return { day, earnings: +dayEarnings.toFixed(2) };
  });

  return {
    restaurant: { id: restaurant.id, name: restaurant.name, isOpen: restaurant.isOpen },
    todayOrders,
    todayEarnings: +todayEarnings.toFixed(2),
    activeOrders,
    completionRate,
    weeklyChart,
  };
}

// ─── Orders ───────────────────────────────────────────────────────────────────

async function getIncomingOrders(ownerId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  return prisma.order.findMany({
    where: { restaurantId: restaurant.id, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { name: true, phone: true } },
      items: { include: { menuItem: { select: { name: true } } } },
    },
  });
}

async function getActiveOrders(ownerId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  return prisma.order.findMany({
    where: { restaurantId: restaurant.id, status: { in: [CONFIRMED, PREPARING] } },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { name: true, phone: true } },
      items: { include: { menuItem: { select: { name: true } } } },
    },
  });
}

async function getCompletedOrders(ownerId, { page = 1, limit = 20 } = {}) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId: restaurant.id, status: DELIVERED },
      skip, take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { name: true } },
        items: true,
      },
    }),
    prisma.order.count({ where: { restaurantId: restaurant.id, status: DELIVERED } }),
  ]);
  return { orders, total, page, limit };
}

async function acceptOrder(ownerId, orderId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const order = await prisma.order.findFirst({ where: { id: orderId, restaurantId: restaurant.id } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (order.status !== 'PENDING') throw new AppError(400, 'INVALID_STATUS', 'Order is not pending');

  return prisma.order.update({ where: { id: orderId }, data: { status: CONFIRMED } });
}

async function rejectOrder(ownerId, orderId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const order = await prisma.order.findFirst({ where: { id: orderId, restaurantId: restaurant.id } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (order.status !== 'PENDING') throw new AppError(400, 'INVALID_STATUS', 'Order is not pending');

  return prisma.order.update({ where: { id: orderId }, data: { status: CANCELLED } });
}

async function markReady(ownerId, orderId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const order = await prisma.order.findFirst({ where: { id: orderId, restaurantId: restaurant.id } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (order.status !== CONFIRMED && order.status !== PREPARING) {
    throw new AppError(400, 'INVALID_STATUS', 'Order must be confirmed or preparing to mark ready');
  }

  return prisma.order.update({ where: { id: orderId }, data: { status: PREPARING } });
}

async function delayOrder(ownerId, orderId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const order = await prisma.order.findFirst({ where: { id: orderId, restaurantId: restaurant.id } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

  return prisma.order.update({ where: { id: orderId }, data: { isDelayed: true } });
}

async function acceptAllOrders(ownerId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const result = await prisma.order.updateMany({
    where: { restaurantId: restaurant.id, status: 'PENDING' },
    data: { status: CONFIRMED },
  });
  return { accepted: result.count };
}

// ─── Restaurant Profile ───────────────────────────────────────────────────────

async function getProfile(ownerId) {
  return getOwnerRestaurant(ownerId);
}

async function updateProfile(ownerId, data) {
  const existing = await prisma.restaurant.findFirst({ where: { ownerId } });
  if (!existing) {
    return prisma.restaurant.create({ data: { ownerId, address: 'N/A', name: 'My Restaurant', ...data } });
  }
  return prisma.restaurant.update({ where: { id: existing.id }, data });
}

async function toggleOpen(ownerId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  return prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { isOpen: !restaurant.isOpen },
  });
}

// ─── Menu Management ──────────────────────────────────────────────────────────

async function getMenu(ownerId, { category, search, availableOnly } = {}) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const where = { restaurantId: restaurant.id };
  if (category) where.category = { equals: category, mode: 'insensitive' };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (availableOnly === 'true' || availableOnly === true) where.isAvailable = true;

  return prisma.menuItem.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

async function addMenuItem(ownerId, data) {
  const restaurant = await getOwnerRestaurant(ownerId);
  return prisma.menuItem.create({ data: { restaurantId: restaurant.id, ...data } });
}

async function updateMenuItem(ownerId, itemId, data) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId: restaurant.id } });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found');
  return prisma.menuItem.update({ where: { id: itemId }, data });
}

async function toggleMenuItemAvailability(ownerId, itemId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId: restaurant.id } });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found');
  return prisma.menuItem.update({ where: { id: itemId }, data: { isAvailable: !item.isAvailable } });
}

async function deleteMenuItem(ownerId, itemId) {
  const restaurant = await getOwnerRestaurant(ownerId);
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId: restaurant.id } });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found');
  await prisma.menuItem.delete({ where: { id: itemId } });
}

module.exports = {
  getDashboard,
  getIncomingOrders, getActiveOrders, getCompletedOrders,
  acceptOrder, rejectOrder, markReady, delayOrder, acceptAllOrders,
  getProfile, updateProfile, toggleOpen,
  getMenu, addMenuItem, updateMenuItem, toggleMenuItemAvailability, deleteMenuItem,
};
