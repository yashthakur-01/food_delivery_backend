'use strict';

const { Router } = require('express');

const controller = require('./controller');
const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');
const validate = require('../../common/middleware/validate');

// seller authorization here
const { RBAC } = require('../../common/constants/rbac'); //i have a better idea
const sellerGuard = [authenticate, authorize(...RBAC.GROCERY_STORE_WRITE)]

const {
  createStoreSchema,
  updateStoreSchema,
  createProductSchema,
  updateProductSchema,
  updateStockSchema
} = require('./validation');

const router = Router();

// ---------------- PUBLIC STORE APIs ----------------

// List all approved grocery stores
router.get(
  '/',
  controller.listStores
);

router.get(
    '/seller/store',
    ...sellerGuard,
    controller.getSellerStore
);

// Get a single grocery store
router.get(
  '/:id',
  controller.getStore
);

// List products of a store
router.get(
  '/:id/products',
  controller.listStoreProducts
);

// Search grocery products
router.get(
  '/products/search',
  controller.searchProducts
);

// Get single product
router.get(
  '/products/:id',
  controller.getProduct
);



router.patch(
    '/:storeId/toggle-open',
    ...sellerGuard,
    controller.toggleStoreOpen
);


// Seller routes
router.post(
  '/profile',
  ...sellerGuard,
  validate(createStoreSchema),
  controller.createStore
);

router.put(
  '/profile',
  authenticate,
  ...sellerGuard,
  validate(updateStoreSchema),
  controller.updateStore
);

// POST   /api/grocery/products
router.post(
  '/products',
  ...sellerGuard,
  validate(createProductSchema),
  controller.createProduct
);

// Search products
router.get(
  '/products/search',
  controller.searchProducts
);


// PATCH  /api/grocery/products/:id
router.patch(
  '/products/:id',
  ...sellerGuard,
  validate(updateProductSchema),
  controller.updateProduct
);

// PATCH  /api/grocery/products/:id/stock
router.patch(
    '/products/:id/stock',
    ...sellerGuard,
    validate(updateStockSchema),
    controller.updateStock
);

// PATCH  /api/grocery/products/:id/toggle
router.patch(
  '/products/:id/toggle',
  ...sellerGuard,
  validate(updateProductSchema),
  controller.toggleProductAvailability);

// DELETE /api/grocery/products/:id 
router.delete(
  '/products/:id',
  ...sellerGuard,
  controller.deleteProduct
);

module.exports = router;


// GET product by id
router.get(
  '/products/:id',
  controller.getProduct
);

// GET all products of a store
router.get(
  '/:id/products',
  controller.listStoreProducts
);


// Update stock
router.patch(
  '/products/:id/stock',
  ...sellerGuard,
  validate(updateStockSchema),
  controller.updateStock
);