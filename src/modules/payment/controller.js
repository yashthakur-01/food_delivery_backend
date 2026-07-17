'use strict';

const paymentService = require('./service');
const { success } = require('../../common/utils/response');

const createPayment = async (req, res, next) => {
  try {
    const result = await paymentService.createPayment({ ...req.body, userId: req.user.id });
    return success(res, 'Payment order created', result, 201);
  } catch (err) { next(err); }
};

const verifyPayment = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const result = await paymentService.verifyPayment({ ...req.body, userId: req.user.id }, io);
    return success(res, 'Payment verified', result);
  } catch (err) { next(err); }
};

/**
 * POST /api/payments/webhook
 * Razorpay sends raw body — must be parsed with express.raw() before this handler.
 */
const webhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) return res.status(400).json({ success: false, message: 'Missing signature header' });

    const io = req.app.get('io');
    const result = await paymentService.handleWebhook(req.body, signature, io);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = { createPayment, verifyPayment, webhook };
