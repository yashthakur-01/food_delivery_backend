'use strict';

const { Router } = require('express');

const controller = require('./controller');
const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');
const validate = require('../../common/middleware/validate');

const { RBAC } = require('../../common/constants/rbac');

const {
  createStoreSchema,
  updateStoreSchema,
} = require('./validation');

const router = Router();

router.post(
  '/profile',
  authenticate,
  authorize(...RBAC.GROCERY_STORE_WRITE),
  validate(createStoreSchema),
  controller.createStore
);

router.put(
  '/profile',
  authenticate,
  authorize(...RBAC.GROCERY_STORE_WRITE),
  validate(updateStoreSchema),
  controller.updateStore
);

module.exports = router;