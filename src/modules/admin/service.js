'use strict';

const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');

const approveRestaurant = async (restaurantId) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
  }

  return prisma.restaurant.update({
    where: { id: restaurantId },
    data: { approvalStatus: 'approved' },
  });
};

const approveDeliveryAgent = async (agentId) => {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
  });

  if (!agent) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  if (agent.role !== 'delivery') {
    throw new AppError(400, 'BAD_REQUEST', 'User is not a delivery agent');
  }

  return prisma.user.update({
    where: { id: agentId },
    data: { status: 'active' },
  });
};

const approveStore = async (storeId) => {
  const store = await prisma.store.findUnique({
    where: { id: storeId}
  });

  if(!store){
    throw new AppError(404, 'NOT_FOUND', 'Store not found');
  }

  if(store.approvalStatus === 'approved'){
    throw new AppError(400, 'BAD_REQUEST', 'Store is already approved');
  }

  return prisma.store.update({
    where: { id: storeId },
    data : { approvalStatus: 'approved'}
  });
} 

const getAnalytics = async ({ startDate, endDate }) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const [totalOrders, revenueResult, activeRestaurants, activeAgents] = await Promise.all([
    // Total orders created within range
    prisma.order.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    }),

    // Total revenue: sum of totalAmount where payment status is SUCCESS
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'SUCCESS',
        order: { createdAt: { gte: start, lte: end } },
      },
    }),

    // Active restaurants: approved AND open
    prisma.restaurant.count({
      where: {
        approvalStatus: 'approved',
        isOpen: true,
      },
    }),

    // Active delivery agents: role = 'delivery' AND status = 'active'
    prisma.user.count({
      where: {
        role: 'delivery',
        status: 'active',
      },
    }),
  ]);

  return {
    totalOrders,
    totalRevenue: revenueResult._sum.amount ?? 0,
    activeRestaurants,
    activeDeliveryAgents: activeAgents,
  };
};

const getDashboard = async () => {
  const [
    totalUsers,
    totalRestaurants,
    totalDeliveryAgents,
    totalOrders,
    revenueResult,
    pendingRestaurants,
    pendingDeliveryAgents,
    pendingStores,
    recentOrders,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: 'customer' },
    }),

    prisma.restaurant.count(),

    prisma.user.count({
      where: { role: 'delivery' },
    }),

    prisma.order.count(),

    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'SUCCESS' },
    }),

    prisma.restaurant.count({
      where: { approvalStatus: 'pending' },
    }),

    prisma.user.count({
      where: {
        role: 'delivery',
        NOT: { status: 'active' },
      },
    }),

    prisma.store.count({
      where: {approvalStatus: 'pending'}
    }),

    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    totalUsers,
    totalRestaurants,
    totalDeliveryAgents,
    totalOrders,
    totalRevenue: revenueResult._sum.amount ?? 0,
    pendingRestaurants,
    pendingDeliveryAgents,
    recentOrders,
  };
};

module.exports = { approveRestaurant, approveDeliveryAgent, getAnalytics, getDashboard
 };
