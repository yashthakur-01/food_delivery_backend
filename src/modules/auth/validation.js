'use strict';

const Joi = require('joi');
const roles = require('../../common/constants/roles');

// Roles allowed to self-register (admin is created out-of-band)
const REGISTERABLE_ROLES = [roles.CUSTOMER, roles.RESTAURANT_OWNER, roles.DELIVERY];

const registerSchema = Joi.object({
  name:     Joi.string().trim().min(1).max(100).required(),
  email:    Joi.string().email().lowercase().trim().optional(),
  phone:    Joi.string().trim().optional(),
  password: Joi.string().min(8).required(),
  role:     Joi.string().valid(...REGISTERABLE_ROLES).required(),
}).or('email', 'phone'); // at least one identifier required

// Verify OTP after registration (phone or email)
// DISABLED - Users are now auto-verified on registration
// const verifyOtpSchema = Joi.object({
//   identifier: Joi.string().trim().required(), // phone or email
//   otp:        Joi.string().pattern(/^\d{6}$/).required(),
// });

// Password-based login — identifier is phone or email
const loginPasswordSchema = Joi.object({
  identifier: Joi.string().trim().required(), // phone or email
  password:   Joi.string().required(),
  role:       Joi.string().valid(...Object.values(roles)).required(),
});

// OTP login step 1 — request OTP
const loginOtpRequestSchema = Joi.object({
  identifier: Joi.string().trim().required(), // phone or email
  role:       Joi.string().valid(...Object.values(roles)).required(),
});

// OTP login step 2 — verify OTP and get tokens
const loginOtpVerifySchema = Joi.object({
  identifier: Joi.string().trim().required(),
  otp:        Joi.string().pattern(/^\d{6}$/).required(),
  role:       Joi.string().valid(...Object.values(roles)).required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const logoutSchema = Joi.object();

module.exports = {
  registerSchema,
  // verifyOtpSchema,
  loginPasswordSchema,
  loginOtpRequestSchema,
  loginOtpVerifySchema,
  refreshSchema,
  logoutSchema,
};
