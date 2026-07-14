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
  controller.updateStore
);
 // GET /api/grocery/stores
router.get(
    '/stores',
    controller.listStores
);

// GET /api/grocery/stores/:id
router.get(
    '/stores/:id',
    controller.getStore
);

// GET /api/grocery/seller/store
router.get(
    '/seller/store',
    ...sellerGuard,
    controller.getSellerStore
);

// PATCH /api/grocery/stores/:storeId/toggle-open
router.patch(
    '/stores/:storeId/toggle-open',
    ...sellerGuard,
    controller.toggleStoreOpen
);

// POST   /api/grocery/products
router.post(
  '/products',
  ...sellerGuard,
  validate(createProductSchema),
  controller.createProduct
);

// PATCH  /api/grocery/products/:id
router.patch(
  '/products/:id',
  ...sellerGuard,
  validate(updateProductSchema),
  controller.updateProduct
);

// PATCH  /api/grocery/products/:id/toggle
router.patch(
  '/products/:id/toggle',
  ...sellerGuard,
  controller.toggleProductAvailability);

// DELETE /api/grocery/products/:id 
router.delete(
  '/products/:id',
  ...sellerGuard,
  controller.deleteProduct
);

// GET /api/grocery/stores/:id/products
router.get(
    '/stores/:id/products',
    controller.listStoreProducts
);

// GET /api/grocery/products/search
router.get(
    '/products/search',
    controller.searchProducts
);

// GET /api/grocery/products/:id
router.get(
    '/products/:id',
    controller.getProduct
);

// PATCH /api/grocery/products/:id/stock
router.patch(
    '/products/:id/stock',
    ...sellerGuard,
    validate(updateStockSchema),
    controller.updateStock
);

module.exports = router;