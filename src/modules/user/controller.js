'use strict';

const service = require('./service');
const favService = require('./favorites.service');
const walletService = require('./wallet.service');
const prisma = require('../../config/db');
const { success } = require('../../common/utils/response');

/** GET /users/me — profile with wallet balance + unread notification count */
async function getProfile(req, res, next) {
  try {
    const [profile, wallet, unreadCount] = await Promise.all([
      service.getProfile(req.user.id),
      walletService.getBalance(req.user.id),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);
    return success(res, 'Profile retrieved', { ...profile, walletBalance: wallet.balance, unreadNotifications: unreadCount });
  } catch (err) { next(err); }
}

/** PATCH /users/me */
async function updateProfile(req, res, next) {
  try {
    const profile = await service.updateProfile(req.user.id, req.body);
    return success(res, 'Profile updated', profile);
  } catch (err) { next(err); }
}

/** GET /users/addresses */
async function getAddresses(req, res, next) {
  try {
    const addresses = await prisma.address.findMany({ where: { userId: req.user.id } });
    return success(res, 'Addresses retrieved', addresses);
  } catch (err) { next(err); }
}

/** POST /users/addresses */
async function addAddress(req, res, next) {
  try {
    const address = await service.addAddress(req.user.id, req.body);
    return success(res, 'Address added', address, 201);
  } catch (err) { next(err); }
}

/** DELETE /users/addresses/:id */
async function deleteAddress(req, res, next) {
  try {
    await service.deleteAddress(req.user.id, req.params.id);
    return success(res, 'Address deleted', null);
  } catch (err) { next(err); }
}

// ─── Favorites ────────────────────────────────────────────────────────────────

/** GET /users/favorites */
async function getFavorites(req, res, next) {
  try {
    const favorites = await favService.getFavorites(req.user.id);
    return success(res, 'Favorites retrieved', favorites);
  } catch (err) { next(err); }
}

/** POST /users/favorites/:restaurantId */
async function addFavorite(req, res, next) {
  try {
    const fav = await favService.addFavorite(req.user.id, req.params.restaurantId);
    return success(res, 'Added to favorites', fav, 201);
  } catch (err) { next(err); }
}

/** DELETE /users/favorites/:restaurantId */
async function removeFavorite(req, res, next) {
  try {
    await favService.removeFavorite(req.user.id, req.params.restaurantId);
    return success(res, 'Removed from favorites', null);
  } catch (err) { next(err); }
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

/** GET /users/wallet */
async function getWallet(req, res, next) {
  try {
    const data = await walletService.getTransactions(req.user.id, req.query);
    return success(res, 'Wallet retrieved', data);
  } catch (err) { next(err); }
}

/**GET Dashboard */
async function getDashboard(req, res, next) {
  try {
    const data = await service.getDashboard(req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Customer dashboard retrieved',
      data,
    });
  } catch (err) {
    next(err);
  }
}


module.exports = {
  getProfile, updateProfile,
  getAddresses, addAddress, deleteAddress,
  getFavorites, addFavorite, removeFavorite,
  getWallet, getDashboard,
};
