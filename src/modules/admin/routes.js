'use strict';

const { Router } = require('express');
const router = Router();

const authenticate = require('../../common/middleware/authenticate');
const authorize = require('../../common/middleware/authorize');
const { analyticsSchema } = require('./validation');
const controller = require('./controller');

// Inline query validator for analytics (validate middleware targets req.body)
const validateQuery = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
    });
  }
  next();
};

router.post(
  '/restaurants/:id/approve',
  authenticate,
  authorize('admin'),
  controller.approveRestaurant
);

router.post(
  '/agents/:id/approve',
  authenticate,
  authorize('admin'),
  controller.approveDeliveryAgent
);

router.post(
  '/stores/:id/approve',
  authenticate,
  authorize('admin'),
  controller.approveStore
)

router.get(
  '/analytics',
  authenticate,
  authorize('admin'),
  validateQuery(analyticsSchema),
  controller.getAnalytics
);

router.get(
  '/dashboard',
  authenticate,
  authorize('admin'),
  controller.getDashboard
);

router.get(
  '/pending-approvals/restaurants',
  authenticate,
  authorize('admin'),
  controller.getPendingRestaurants
)

router.get(
  '/pending-approvals/delivery-agents',
  authenticate,
  authorize('admin'),
  controller.getPendingDeliveryAgents
)

router.get(
  '/pending-approvals/stores',
  authenticate,
  authorize('admin'),
  controller.getPendingStores
)

module.exports = router;
