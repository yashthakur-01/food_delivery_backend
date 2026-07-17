'use strict';

const crypto = require('crypto');
const { randomUUID } = require('crypto');
const Razorpay = require('razorpay');
const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');
const PAYMENT_STATUS = require('../../common/constants/paymentStatus');
const ORDER_STATUS = require('../../common/constants/orderStatus');
const { emitNewOrder, emitOrderStatusUpdate } = require('../../sockets/orderHandlers');
const { emitNewDeliveryRequest } = require('../../sockets/deliveryHandlers');
const { restoreStockForOrder } = require('../../common/utils/stockUtils');
// ─── Razorpay client (lazy — only initialised when keys are present) ──────────

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ─── 17.2 Create payment order ────────────────────────────────────────────────

/**
 * Creates a Razorpay order (or falls back to a mock reference when keys are absent).
 * Returns the payment record + Razorpay order details the client needs to open the SDK.
 */
const createPayment = async ({ orderId, amount, method, userId }) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  if (order.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You can only create payment for your own order');

  const existing = await prisma.payment.findUnique({ where: { orderId } });
  if (existing) throw new AppError(400, 'PAYMENT_EXISTS', 'Payment already exists for this order');

  const razorpay = getRazorpay();
  let razorpayOrderId = null;
  let razorpayKeyId = null;

  if (razorpay) {
    // Amount in paise (Razorpay uses smallest currency unit)
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `order_${orderId}`,
      notes: { orderId, userId },
    });
    razorpayOrderId = rzpOrder.id;
    razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  }

  const payment = await prisma.payment.create({
    data: {
      orderId,
      amount,
      method,
      status: PAYMENT_STATUS.PENDING,
      reference: randomUUID(),
      razorpayOrderId,
    },
  });

  return {
    payment,
    razorpay: razorpayOrderId
      ? { orderId: razorpayOrderId, amount: Math.round(amount * 100), currency: 'INR', keyId: razorpayKeyId }
      : null,
  };
};

// ─── 17.3 Verify payment (signature validation) ───────────────────────────────

/**
 * Verifies the Razorpay signature returned by the client after payment.
 * Falls back to the old mock-success flow when Razorpay keys are absent.
 */
const verifyPayment = async ({ paymentId, razorpayPaymentId, razorpayOrderId, razorpaySignature, success: mockSuccess, userId }, io) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });

  if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
  if (payment.order.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You can only verify your own payment');
  if (payment.status !== PAYMENT_STATUS.PENDING) throw new AppError(400, 'INVALID_PAYMENT_STATE', 'Only pending payments can be verified');

  let verified = false;

  if (razorpayPaymentId && razorpayOrderId && razorpaySignature) {
    // 17.3 — Real Razorpay signature validation
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new AppError(500, 'CONFIG_ERROR', 'Razorpay not configured');

    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    verified = expectedSignature === razorpaySignature;
  } else {
    // Fallback: mock success flag (used in tests / when Razorpay not configured)
    verified = !!mockSuccess;
  }

  // 17.4 — Update payment status in DB
  let updatedPayment, updatedOrder;

  if (verified) {
    updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PAYMENT_STATUS.SUCCESS,
        razorpayPaymentId: razorpayPaymentId || null,
        razorpaySignature: razorpaySignature || null,
      },
    });
    updatedOrder = await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: ORDER_STATUS.CONFIRMED },
      include: { restaurant: true, store: true }
    });

    if (io) {
      emitOrderStatusUpdate(io, updatedOrder.userId, {
        order_id: updatedOrder.id,
        status: ORDER_STATUS.CONFIRMED,
      });

      const ownerId = updatedOrder.restaurant ? updatedOrder.restaurant.ownerId : (updatedOrder.store ? updatedOrder.store.ownerId : null);
      if (ownerId) {
        emitNewOrder(io, ownerId, { order_id: updatedOrder.id, status: ORDER_STATUS.CONFIRMED });
      }
    }
  } else {
    updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: PAYMENT_STATUS.FAILED },
    });
    updatedOrder = await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: ORDER_STATUS.CANCELLED },
    });

    // ── Stock restoration on payment failure (grocery orders only) ──────────
    // When payment fails, the order is cancelled; restore grocery stock so
    // other customers can buy the same items.
    if (payment.order.storeId) {
      await restoreStockForOrder(prisma, payment.orderId);
    }
  }

  return { payment: updatedPayment, order: updatedOrder };
};

// ─── 17.5 Razorpay webhook handler ───────────────────────────────────────────

/**
 * Validates the Razorpay webhook signature and processes the event.
 * rawBody must be the raw Buffer from express.raw() middleware.
 */
const handleWebhook = async (rawBody, signature, io) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw new AppError(500, 'CONFIG_ERROR', 'Webhook secret not configured');

  // Validate signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Webhook signature mismatch');
  }

  const event = JSON.parse(rawBody.toString());
  const entity = event?.payload?.payment?.entity;

  if (!entity) return { processed: false, event: event.event };

  const razorpayOrderId = entity.order_id;
  const razorpayPaymentId = entity.id;

  const payment = await prisma.payment.findFirst({ where: { razorpayOrderId } });
  if (!payment) return { processed: false, reason: 'Payment record not found' };

  if (payment.status !== PAYMENT_STATUS.PENDING) {
    return { processed: true, reason: 'Payment already processed' };
  }

  switch (event.event) {
    case 'payment.captured': {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PAYMENT_STATUS.SUCCESS, razorpayPaymentId },
      });
      const updatedOrder = await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: ORDER_STATUS.CONFIRMED },
        include: { restaurant: true, store: true }
      });

      if (io) {
        emitOrderStatusUpdate(io, updatedOrder.userId, {
          order_id: updatedOrder.id,
          status: ORDER_STATUS.CONFIRMED,
        });

        const ownerId = updatedOrder.restaurant ? updatedOrder.restaurant.ownerId : (updatedOrder.store ? updatedOrder.store.ownerId : null);
        if (ownerId) {
          emitNewOrder(io, ownerId, { order_id: updatedOrder.id, status: ORDER_STATUS.CONFIRMED });
        }
      }
      break;
    }
    case 'payment.failed': {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PAYMENT_STATUS.FAILED, razorpayPaymentId },
      });
      const cancelledOrder = await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: ORDER_STATUS.CANCELLED },
      });

      // ── Stock restoration on webhook payment failure (grocery orders only) ─
      if (cancelledOrder.storeId) {
        await restoreStockForOrder(prisma, payment.orderId);
      }
      break;
    }
    case 'refund.created':
    case 'refund.processed': {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PAYMENT_STATUS.REFUNDED },
      });
      break;
    }
    default:
      return { processed: false, event: event.event };
  }

  return { processed: true, event: event.event };
};

// ─── Refund ───────────────────────────────────────────────────────────────────

const processRefund = async (orderId, amount) => {
  const payment = await prisma.payment.findUnique({
    where:{ orderId }
  });

  if(!payment){
    throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
  }

  if(payment.status !== PAYMENT_STATUS.SUCCESS){
    throw new AppError(400, 'INVALID_PAYMENT', 'Only successful payments can be refunded');
  }

  const razorpay = getRazorpay();

  if(razorpay && payment.razorpayPaymentId){
    await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(amount * 100)
    });
  }

  return prisma.payment.update({
    where:{ id: payment.id },
    data:{ status: PAYMENT_STATUS.REFUNDED }
  });
};

module.exports = { createPayment, verifyPayment, handleWebhook, processRefund };
