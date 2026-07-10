'use strict';

const service = require('./service');
const { success } = require('../../common/utils/response');

async function createStore(req, res, next) {
  try {
    const store = await service.createStore(
      req.user.id,
      req.body
    );

    return success(
      res,
      'Store profile created',
      store,
      201
    );
  } catch (err) {
    next(err);
  }
}

async function updateStore(req, res, next) {
  try {
    const store = await service.updateStore(
      req.user.id,
      req.body
    );

    return success(
      res,
      'Store profile updated',
      store
    );
  } catch (err) {
    next(err);
  }
}

// PRODUCTS

// POST /api/grocery/products 
async function createProduct(req, res, next) {
  try {
    const product = await service.createProduct(req.user.id, req.body);
    return success(res, 'Product added', product, 201);
  } catch (err) { next(err); }
}

// PATCH /api/grocery/products/:id 
async function updateProduct(req, res, next) {
  try {
    const product = await service.updateProduct(req.params.id, req.user.id, req.body);
    return success(res, 'Product updated', product);
  } catch (err) { next(err); }
}

// PATCH /api/grocery/products/:id/toggle 
async function toggleProductAvailability(req, res, next) {
  try {
    const product = await service.toggleProductAvailability(req.params.id, req.user.id);
    return success(res, `Product is now ${product.isAvailable ? 'available' : 'unavailable'}`, product);
  } catch (err) { next(err); }
}

// DELETE /api/grocery/products/:id 
async function deleteProduct(req, res, next) {
  try {
    await service.deleteProduct(req.params.id, req.user.id);
    return success(res, 'Product deleted', null);
  } catch (err) { next(err); }
}

module.exports = {
  createStore,
  updateStore,
  createProduct,
  updateProduct,
  toggleProductAvailability,
  deleteProduct
};