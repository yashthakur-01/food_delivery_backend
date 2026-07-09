'use strict';

const { Router } = require('express');
const controller = require('./controller');
const { createOrderSchema, updateOrderStatusSchema, orderRequestSchema } = require('./validation');
const validate = require('../../common/middleware/validate');
const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');

const router = Router();

// Customer routes
router.post('/',           authenticate, authorize('customer'),                        validate(createOrderSchema),      controller.createOrder);
router.get('/',            authenticate, authorize('customer'),                        controller.getOrders);
router.post('/:id/cancel', authenticate, authorize('customer'),                        controller.cancelOrder);
router.post('/:id/request',authenticate, authorize('customer'),                        validate(orderRequestSchema),     controller.createOrderRequest);


// Restaurant owner + delivery agent status updates
router.patch('/:id/status', authenticate, authorize('restaurant_owner', 'delivery'),  validate(updateOrderStatusSchema), controller.updateOrderStatus);

module.exports = router;
