'use strict';

const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');

async function createStore(ownerId, data) {
  const existingStore = await prisma.groceryStore.findFirst({
    where: { ownerId },
  });

  if (existingStore) {
    throw new AppError(
      409,
      'CONFLICT',
      'Store profile already exists for this seller'
    );
  }

  return prisma.groceryStore.create({
    data: {
      ...data,
      ownerId,
      storeType: data.storeType || 'GROCERY',
      approvalStatus: 'pending',
    },
  });
}

async function updateStore(ownerId, data) {
  const store = await prisma.groceryStore.findFirst({
    where: { ownerId },
  });

  if (!store) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'Store profile not found'
    );
  }

  return prisma.groceryStore.update({
    where: { id: store.id },
    data,
  });
}

module.exports = {
  createStore,
  updateStore,
};