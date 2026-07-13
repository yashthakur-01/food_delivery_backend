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


// list the stores with some filters and pagination 
// GET - /api/grocery/stores
async function listStores({ page = 1, limit = 20, category } = {}) {
  const skip  = (page - 1) * limit;
  const where = { approvalStatus: 'approved', storeType: 'GROCERY' };
  if (category) where.category = { equals: category, mode: 'insensitive' };

  const [stores, total] = await Promise.all([
    prisma.groceryStore.findMany({
      where,
      skip,
      take: limit,
      orderBy: { isFeatured: 'desc' },
      select: {
        id: true, name: true, description: true, category: true,
        imageUrl: true, rating: true, ratingCount: true,
        deliveryFee: true, minOrderAmount: true,
        isOpen: true, offerTag: true, latitude: true, longitude: true,
      },
    }),
    prisma.groceryStore.count({ where }),
  ]);

  return { stores, total, page, limit };
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
async function toggleStoreOpen(storeId, ownerId) {
  const store = await assertOwnership(storeId, ownerId);
  return prisma.groceryStore.update({
    where: { id: storeId },
    data:  { isOpen: !store.isOpen },
  });
}

// GET - /api/grocery/seller/store
//  this is for that seller gets their own store profile
async function getSellerStore(ownerId){
  return getOwnerStore(ownerId);
}


// -------- PRODUCT

// listing the products GET - /api/grocery/stores/:id/products
async function listStoreProducts(storeId, { page = 1, limit = 20, category, availableOnly } = {}) {
  // Verify store exists
  const store = await prisma.groceryStore.findUnique({ where: { id: storeId } });
  if (!store) throw new AppError(404, 'NOT_FOUND', 'Grocery store not found');

  const skip  = (page - 1) * limit;
  const where = { storeId };
  if (category)     where.category    = { equals: category, mode: 'insensitive' };
  if (availableOnly) where.isAvailable = true;

  const [products, total] = await Promise.all([
    prisma.groceryProduct.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.groceryProduct.count({ where }),
  ]);

  return { products, total, page, limit };
}

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

// Seach products - GET - /api/grocery/products/search?q=
async function searchProducts(query, { page = 1, limit = 20 } = {}) {
  if (!query || query.trim().length === 0) throw new AppError(400, 'BAD_REQUEST', 'Search query is required');

  const skip = (page - 1) * limit;
  const q    = query.trim();

  const [products, total] = await Promise.all([
    prisma.groceryProduct.findMany({
      where: {
        isAvailable: true,
        OR: [
          { name:     { contains: q, mode: 'insensitive' } },
          { brand:    { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
      skip,
      take: limit,
      orderBy: { soldCount: 'desc' },
      include: {
        store: { select: { id: true, name: true, imageUrl: true, isOpen: true } },
      },
    }),
    prisma.groceryProduct.count({
      where: {
        isAvailable: true,
        OR: [
          { name:     { contains: q, mode: 'insensitive' } },
          { brand:    { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
    }),
  ]);

  return { products, total, page, limit, query: q };
}

// Updating the Stock
// PATCH - /api/grocery/products/:id/stock
async function updateStock(productId, ownerId, stock) {
  const product = await prisma.groceryProduct.findUnique({ where: { id: productId } });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  await assertOwnership(product.storeId, ownerId);

  return prisma.groceryProduct.update({ where: { id: productId }, data: { stock } });
}

//delete produt - /api/grocery/produts/:id
async function deleteProduct(productId, ownerId) {
  const product = await prisma.groceryProduct.findUnique({ where: { id: productId } });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  await assertOwnership(product.storeId, ownerId);

  await prisma.groceryProduct.delete({ where: { id: productId } });
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
  listStores,
  toggleStoreOpen,
  getSellerStore,
  listStoreProducts,
  searchProducts,
  updateStock,
  deleteProduct,
};