'use strict';

const { Router } = require('express');
const controller = require('./controller');
const {
  registerSchema,
  // verifyOtpSchema,
  loginPasswordSchema,
  loginOtpRequestSchema,
  loginOtpVerifySchema,
  refreshSchema,
  logoutSchema,
} = require('./validation');
const validate = require('../../common/middleware/validate');
const authenticate = require('../../common/middleware/authenticate');
const rateLimiter = require('../../common/middleware/rateLimiter');

const router = Router();

// Registration & verification
router.post('/register',           rateLimiter, validate(registerSchema),         controller.register);
// router.post('/verify-otp',         rateLimiter, validate(verifyOtpSchema),         controller.verifyOtp);

// Password login
router.post('/login/password',     rateLimiter, validate(loginPasswordSchema),     controller.loginWithPassword);

// OTP login (2-step)
router.post('/login/otp/request',  rateLimiter, validate(loginOtpRequestSchema),   controller.requestLoginOtp);
router.post('/login/otp/verify',   rateLimiter, validate(loginOtpVerifySchema),    controller.verifyLoginOtp);

// Token management
router.post('/refresh',            rateLimiter, validate(refreshSchema),           controller.refresh);
router.post('/logout',             authenticate, validate(logoutSchema),           controller.logout);

module.exports = router;
