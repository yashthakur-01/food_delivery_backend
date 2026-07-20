'use strict';

const { Router } = require('express');
const controller = require('./controller');
const { createOrderSchema, updateOrderStatusSchema, orderRequestSchema } = require('./validation');
const validate = require('../../common/middleware/validate');
const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');

const router = Router();

// Customer routes
router.post('/', authenticate, authorize('customer'), validate(createOrderSchema), controller.createOrder);
router.get('/', authenticate, authorize('customer'), controller.getOrders);
router.post('/:id/cancel', authenticate, authorize('customer'), controller.cancelOrder);
router.post('/:id/request', authenticate, authorize('customer'), validate(orderRequestSchema), controller.createOrderRequest);

//Order tracking routes
router.get(
    '/:id/tracking',
    authenticate,
    authorize(
        'customer',
        'restaurant_owner',
        'seller',
        'delivery'
    ),
    controller.getOrderTracking
);

// Restaurant owner + seller + delivery agent status updates
router.patch('/:id/status', authenticate, authorize('restaurant_owner', 'seller', 'delivery'), validate(updateOrderStatusSchema), controller.updateOrderStatus);

// Unified order request endpoints for restaurant owners and sellers
router.get('/requests/:id', authenticate, authorize('restaurant_owner', 'seller'), controller.getOrderRequestForOwner);
router.patch('/requests/:id', authenticate, authorize('restaurant_owner', 'seller'), controller.updateOrderRequestForOwner);

module.exports = router;
