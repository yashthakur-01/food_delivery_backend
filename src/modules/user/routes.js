'use strict';

const { Router } = require('express');
const controller = require('./controller');
const { updateProfileSchema, addAddressSchema } = require('./validation');
const validate = require('../../common/middleware/validate');
const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');

const router = Router();
const guard = [authenticate];
const customerGuard = [authenticate, authorize('customer')];

// Profile
router.get('/me',                       ...guard,         controller.getProfile);
router.patch('/me',                     ...guard,         validate(updateProfileSchema), controller.updateProfile);

// Addresses
router.get('/addresses',                ...customerGuard, controller.getAddresses);
router.post('/addresses',               ...customerGuard, validate(addAddressSchema), controller.addAddress);
router.delete('/addresses/:id',         ...customerGuard, controller.deleteAddress);

// Favorites
router.get('/favorites',                ...customerGuard, controller.getFavorites);
router.post('/favorites/:restaurantId', ...customerGuard, controller.addFavorite);
router.delete('/favorites/:restaurantId',...customerGuard, controller.removeFavorite);

// Wallet
router.get('/wallet',                   ...customerGuard, controller.getWallet);

// Dashboard
router.get('/dashboard',               ...customerGuard, controller.getDashboard);

module.exports = router;
