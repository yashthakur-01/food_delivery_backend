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

  if(restaurant.approvalStatus === 'approved'){
    throw new AppError(400, 'BAD_REQUEST', 'Restaurant is already approved');
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

  if(agent.approvalStatus === 'approved'){
    throw new AppError(400, 'BAD_REQUEST', 'Delivery agent is already approved');
  }

  return prisma.user.update({
    where: { id: agentId },
    data: { approvalStatus: 'approved' },
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
  
  const start = startDate? new Date(startDate): new Date(new Date().setDate(new Date().getDate() - 30)); // Default to last 30 days
  const end = endDate? new Date(endDate): new Date(); // Default to today

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
        approvalStatus: 'pending',
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
    pendingStores,
    recentOrders,
  };
};


const getPendingRestaurants = async () => {
  const pendingRestaurants = await prisma.restaurant.findMany({
    where: {approvalStatus: 'pending'},
    orderBy: { createdAt: 'desc' }
  });
  return pendingRestaurants;
};

const getPendingStores = async () => {
  const pendingStores = await prisma.store.findMany({
    where: {approvalStatus: 'pending'},
    orderBy: { createdAt: 'desc' }
  });
  return pendingStores;
}

const getPendingDeliveryAgents = async () => {
  const pendingAgents = await prisma.user.findMany({
    where: {role: 'delivery', approvalStatus: 'pending'},
    omit: {password: true},
    orderBy: { createdAt: 'desc' }
  })
  return pendingAgents;
}

module.exports = { approveRestaurant, approveDeliveryAgent, getAnalytics, getDashboard, approveStore, getPendingRestaurants, getPendingDeliveryAgents, getPendingStores };
