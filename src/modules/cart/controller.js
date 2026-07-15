'use strict';

const service = require('./service');
const { success } = require('../../common/utils/response');

async function getCart(req, res, next) {
  try {
    const cart = await service.getCart(req.user.id);
    return success(res, 'Cart retrieved', cart);
  } catch (err) { next(err); }
}

async function addItem(req, res, next) {
  try {
    const cart = await service.addItem(req.user.id, req.body);
    return success(res, 'Item added to cart', cart, 201);
  } catch (err) { next(err); }
}

async function removeItem(req, res, next) {
  try {
    const cart = await service.removeItem(req.user.id, req.params.itemId);
    return success(res, 'Item removed from cart', cart);
  } catch (err) { next(err); }
}

async function updateItemQuantity(req, res, next) {
  try {
    const cart = await service.updateItemQuantity(req.user.id, req.params.itemId, req.body.quantity);
    return success(res, 'Cart item updated', cart);
  } catch (err) { next(err); }
}

async function clearCart(req, res, next) {
  try {
    await service.clearCart(req.user.id);
    return success(res, 'Cart cleared', null);
  } catch (err) { next(err); }
}

module.exports = { getCart, addItem, removeItem, updateItemQuantity, clearCart };
