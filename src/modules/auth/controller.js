'use strict';

const service = require('./service');
const { success } = require('../../common/utils/response');

/** POST /auth/register */
async function register(req, res, next) {
  try {
    const user = await service.register(req.body);
    return success(res, 'User registered successfully', user, 201);
  } catch (err) { next(err); }
}

/** POST /auth/verify-otp */
// async function verifyOtp(req, res, next) {
//   try {
//     await service.verifyOtp(req.body);
//     return success(res, 'Account verified successfully', null);
//   } catch (err) { next(err); }
// }

/** POST /auth/login/password */
async function loginWithPassword(req, res, next) {
  try {
    const tokens = await service.loginWithPassword(req.body);
    return success(res, 'Login successful', tokens);
  } catch (err) { next(err); }
}

/** POST /auth/login/otp/request */
async function requestLoginOtp(req, res, next) {
  try {
    await service.requestLoginOtp(req.body);
    return success(res, 'OTP sent successfully', null);
  } catch (err) { next(err); }
}

/** POST /auth/login/otp/verify */
async function verifyLoginOtp(req, res, next) {
  try {
    const tokens = await service.verifyLoginOtp(req.body);
    return success(res, 'Login successful', tokens);
  } catch (err) { next(err); }
}

/** POST /auth/refresh */
async function refresh(req, res, next) {
  try {
    const tokens = await service.refresh({ refreshToken: req.body.refreshToken });
    return success(res, 'Token refreshed', tokens);
  } catch (err) { next(err); }
}

/** POST /auth/logout */
async function logout(req, res, next) {
  try {
    const { id: userId, tokenId } = req.user;
    await service.logout({ userId, tokenId });
    return success(res, 'Logged out successfully', null);
  } catch (err) { next(err); }
}

module.exports = { register, /* verifyOtp, */ loginWithPassword, requestLoginOtp, verifyLoginOtp, refresh, logout };
