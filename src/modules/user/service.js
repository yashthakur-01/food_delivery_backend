'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');

/** Return public profile fields for a user. */
async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, role: true, is_verified: true },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return user;
}

/** Update name, email, phone, and/or password. Enforces uniqueness on email/phone. */
async function updateProfile(userId, { name, email, phone, password }) {
  // Uniqueness checks
  if (email) {
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
    if (existing) throw new AppError(409, 'CONFLICT', 'Email already in use');
  }
  if (phone) {
    const existing = await prisma.user.findFirst({ where: { phone, NOT: { id: userId } } });
    if (existing) throw new AppError(409, 'CONFLICT', 'Phone number already in use');
  }

  const data = {};
  if (name)     data.name  = name;
  if (email)    data.email = email;
  if (phone)    data.phone = phone;
  if (password) data.password = await bcrypt.hash(password, 10);

  return prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, phone: true, role: true, is_verified: true },
  });
}

/** Add a new address for the authenticated user. */
async function addAddress(userId, { address, lat, lng }) {
  return prisma.address.create({
    data: {
      userId,
      line1: address,
      city: 'N/A',
      state: 'N/A',
      pincode: '000000',
      latitude: lat ?? null,
      longitude: lng ?? null,
    },
  });
}

/** Delete an address — 403 if the address doesn't belong to the user. */
async function deleteAddress(userId, addressId) {
  const addr = await prisma.address.findUnique({ where: { id: addressId } });
  if (!addr) throw new AppError(404, 'NOT_FOUND', 'Address not found');
  if (addr.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this address');
  await prisma.address.delete({ where: { id: addressId } });
}

/** Return dashboard summary for the authenticated customer. */
async function getDashboard(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      wallet: {
        select: {
          balance: true,
        },
      },
      _count: {
        select: {
          orders: true,
          favorites: true,
          notifications: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const activeOrders = await prisma.order.count({
    where: {
      userId,
      status: {
        in: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'],
      },
    },
  });

  const recentOrders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      restaurant: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
    },
  });

  const recentNotifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      isRead: true,
      createdAt: true,
    },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    walletBalance: user.wallet?.balance ?? 0,
    totalOrders: user._count.orders,
    activeOrders,
    favoriteRestaurants: user._count.favorites,
    totalNotifications: user._count.notifications,
    recentOrders,
    recentNotifications,
  };
}

module.exports = { getProfile, updateProfile, addAddress, deleteAddress, getDashboard };
