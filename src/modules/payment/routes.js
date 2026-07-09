'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');
const validate = require('../../common/middleware/validate');
const { createPaymentSchema, verifyPaymentSchema } = require('./validation');
const controller = require('./controller');

// Webhook — must use express.raw() to preserve raw body for signature validation
// Registered BEFORE express.json() parses the body
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  controller.webhook
);

router.post(
  '/',
  authenticate, authorize('customer'),
  validate(createPaymentSchema),
  controller.createPayment
);

router.post(
  '/verify',
  authenticate, authorize('customer'),
  validate(verifyPaymentSchema),
  controller.verifyPayment
);

module.exports = router;
