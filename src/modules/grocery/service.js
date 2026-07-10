'use strict';

const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');

//if no store found throw the error resolving sellers grocery store
async function getOwnerStore(ownerId) {
  const store = await prisma.groceryStore.findFirst({
    where: { ownerId }
  });

  if (!store) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'No grocery store found for this seller. Create one first.'
    );
  }
  return store;
}


// assert a store to the requesting seller 
async function assertOwnership(storeId, ownerId) {
  const store = await prisma.groceryStore.findUnique({
    where: { id: storeId }
  });

  if (!store) throw new AppError(
    404,
    'NOT_FOUND',
    'Grocery store not found'
  );

  if (store.ownerId !== ownerId) throw new AppError(
    403,
    'FORBIDDEN',
    'You do not own this store'
  );

  return store;
}



// GET /api/grocery/stores/:id View a single grocery store for public view.
async function getStore(storeId) {
  const store = await prisma.groceryStore.findUnique({
    where: { id: storeId }
  });
  if (!store) throw new AppError(
    404,
    'NOT_FOUND',
    'Grocery store not found'
  );

  return store;
}


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


// toggle functionality is remaining here toggleStoreOpen(storeId, ownerId)



// getting the products here GET - /api/grocery/products/:id
async function getProduct(productId) {
  const product = await prisma.groceryProduct.findUnique({
    where: { id: productId }
  });

  if (!product) throw new AppError(
    404,
    'NOT_FOUND',
    'Product not found'
  );

  return product;
}

// createProduct - POST /api/grocery/products
async function createProduct(ownerId, data) {
  const { storeId, ...productData } = data;
  await assertOwnership(storeId, ownerId);

  return prisma.groceryProduct.create({
    data: { storeId, ...productData },
  });
}

//updateProduct PATCH - /api/grocery/procuts/:id
async function updateProduct(productId, ownerId, data) {
  const product = await prisma.groceryProduct.findUnique({
    where: { id: productId }
  });

  if (!product) throw new AppError(
    404,
    'NOT_FOUND',
    'Product not found'
  );

  await assertOwnership(product.storeId, ownerId);

  return prisma.groceryProduct.update({ where: { id: productId }, data });
}

// toggleProductAvailability PATCH /api/grocery/products/:id/toggle
async function toggleProductAvailability(productId, ownerId) {
  const product = await prisma.groceryProduct.findUnique({
    where: { id: productId }
  });

  if (!product) throw new AppError(
    404,
    'NOT_FOUND',
    'Product not found');

  await assertOwnership(product.storeId, ownerId);

  return prisma.groceryProduct.update({
    where: { id: productId },
    data: { isAvailable: !product.isAvailable },
  });
}

module.exports = {
  createStore,
  updateStore,
  getStore,
  getOwnerStore,
  assertOwnership,
  getProduct,
  createProduct,
  updateProduct,
  toggleProductAvailability,
};