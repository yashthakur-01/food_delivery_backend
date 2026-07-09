'use strict';

const { Router } = require('express');
const controller = require('./controller');
const { addMenuItemSchema, updateMenuItemSchema} = require('./validation');
const validate = require('../../common/middleware/validate');
const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');

const router = Router();

// Public
router.get('/categories',              controller.getCategories);
router.get('/banners',                 controller.getBanners);
router.get('/search',                  controller.searchRestaurants);
router.get('/',                        controller.listRestaurants);
router.get('/:id',                     controller.getRestaurantDetails);

// Customer — search history (optional auth on search, required for history)
router.get('/search/history',          authenticate, controller.getSearchHistory);
router.delete('/search/history/:id',   authenticate, controller.deleteSearchEntry);
router.delete('/search/history',       authenticate, controller.clearSearchHistory);

// Restaurant owner — menu management
router.post('/:id/menu',               authenticate, authorize('restaurant_owner'), validate(addMenuItemSchema),    controller.addMenuItem);
router.patch('/:id/menu/:itemId',      authenticate, authorize('restaurant_owner'), validate(updateMenuItemSchema), controller.updateMenuItem);

// Restaurant owner — replacement requests
router.get('/order-request/:id',       authenticate, authorize('restaurant_owner'), controller.getOrderRequest);
router.patch('/order-request/:id',     authenticate, authorize('restaurant_owner'), controller.updateOrderRequest);

module.exports = router;
