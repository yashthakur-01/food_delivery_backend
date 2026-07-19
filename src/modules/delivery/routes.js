'use strict';

const { Router } = require('express');
const router = Router();

const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');
const validate = require('../../common/middleware/validate');

const controller = require('./controller');
const { acceptOrderSchema, updateLocationSchema, completeOrderSchema } = require('./validation');

const guard = [authenticate, authorize('delivery')];

// ─── Dashboard & status ───────────────────────────────────────────────────────
router.get('/dashboard', ...guard, controller.getDashboard);
router.post('/online', ...guard, controller.goOnline);
router.post('/offline', ...guard, controller.goOffline);

// ─── Order lists ──────────────────────────────────────────────────────────────
router.get('/orders/available', ...guard, controller.getAvailableOrders);
router.get('/orders/active', ...guard, controller.getActiveDelivery);
router.get('/orders/history', ...guard, controller.getDeliveryHistory);

// ─── Order actions ────────────────────────────────────────────────────────────
router.post('/:orderId/accept', ...guard, validate(acceptOrderSchema), controller.acceptOrder);
router.post('/:orderId/reject', ...guard, controller.rejectOrder);
router.post('/:orderId/location', ...guard, validate(updateLocationSchema), controller.updateLocation);
router.post('/:orderId/complete', ...guard, validate(completeOrderSchema), controller.completeOrder);

// ─── Profile ──────────────────────────────────────────────────────────────────
router.get('/profile', ...guard, controller.getFullProfile);
router.get('/profile/vehicle', ...guard, controller.getVehicle);
router.put('/profile/vehicle', ...guard, controller.upsertVehicle);
router.get('/profile/documents', ...guard, controller.getDocuments);
router.put('/profile/documents/:type', ...guard, controller.upsertDocument);
router.get('/profile/bank', ...guard, controller.getBankDetail);
router.put('/profile/bank', ...guard, controller.upsertBankDetail);

module.exports = router;
