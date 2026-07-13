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

module.exports = router;