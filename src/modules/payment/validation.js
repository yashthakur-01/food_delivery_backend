'use strict';

const Joi = require('joi');

const createPaymentSchema = Joi.object({
  orderId: Joi.string().min(1).required(),
  amount: Joi.number().positive().required(),
  method: Joi.string().valid('COD', 'CARD', 'UPI', 'NETBANKING', 'RAZORPAY').required(),
});

// Supports both Razorpay signature flow and legacy mock-success flow
const verifyPaymentSchema = Joi.object({
  paymentId: Joi.string().min(1).required(),
  // Razorpay fields
  razorpayPaymentId: Joi.string().optional(),
  razorpayOrderId: Joi.string().optional(),
  razorpaySignature: Joi.string().optional(),
  // Legacy fallback
  success: Joi.boolean().optional(),
}).or('razorpaySignature', 'success'); // at least one must be present

module.exports = { createPaymentSchema, verifyPaymentSchema };
