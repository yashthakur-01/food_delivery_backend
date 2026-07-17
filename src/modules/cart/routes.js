'use strict';

const { Router } = require('express');
const controller = require('./controller');
const { addItemSchema, updateItemSchema, checkoutSchema } = require('./validation');
const validate = require('../../common/middleware/validate');
const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');

const router = Router();

// All cart routes are customer-only
router.use(authenticate, authorize('customer'));

router.get('/',                    controller.getCart);
router.post('/items',              validate(addItemSchema),      controller.addItem);
router.patch('/items/:itemId',     validate(updateItemSchema),   controller.updateItemQuantity);
router.delete('/items/:itemId',    controller.removeItem);
router.delete('/',                 controller.clearCart);

module.exports = router;
