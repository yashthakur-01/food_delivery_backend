'use strict';

require('dotenv').config({ path: '.env.test' });

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { signAccessToken } = require('../../src/common/utils/jwt');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

/**
 * Create a test user with the given role.
 */
async function createTestUser({
  name = 'Test User',
  phone = null,
  email = null,
  password = DEFAULT_PASSWORD,
  role = 'customer',
  is_verified = true,
} = {}) {
  if (!phone && !email) {
    phone = `+1${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      phone: phone || null,
      email: email || null,
      password: hashed,
      role,
      is_verified,
      status: 'active',
    },
  });

  const tokenPayload = { id: user.id, phone: user.phone, email: user.email, role: user.role };
  const accessToken = signAccessToken(tokenPayload);

  return { ...user, accessToken, rawPassword: password };
}

/**
 * Create a test restaurant.
 */
async function createTestRestaurant({
  name = 'Test Restaurant',
  description = 'A test restaurant',
  address = '123 Test St',
} = {}) {
  return prisma.restaurant.create({
    data: { name, description, address },
  });
}

/**
 * Create a test menu item for a restaurant.
 */
async function createTestMenuItem({
  restaurantId,
  name = 'Test Item',
  description = 'A test menu item',
  price = 9.99,
  isAvailable = true,
} = {}) {
  return prisma.menuItem.create({
    data: { restaurantId, name, description, price, isAvailable },
  });
}

/**
 * Create a test order.
 */
async function createTestOrder({
  userId,
  restaurantId,
  status = 'PENDING',
  totalAmount = 19.99,
} = {}) {
  return prisma.order.create({
    data: { userId, restaurantId, status, totalAmount },
  });
}

/**
 * Create a test payment for an order.
 */
async function createTestPayment({
  orderId,
  amount = 19.99,
  method = 'CARD',
  status = 'pending',
} = {}) {
  const { randomUUID } = require('crypto');
  return prisma.payment.create({
    data: { orderId, amount, method, status, reference: randomUUID() },
  });
}

/**
 * Clean up all test data.
 */
async function cleanDatabase() {
  await prisma.notification.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.deliveryTracking.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.groceryProduct.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.restaurant.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.oTP.deleteMany({});
  await prisma.user.deleteMany({});
}

/**
 * Disconnect Prisma client.
 */
async function disconnectPrisma() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  createTestUser,
  createTestRestaurant,
  createTestMenuItem,
  createTestOrder,
  createTestPayment,
  cleanDatabase,
  disconnectPrisma,
  DEFAULT_PASSWORD,
};
