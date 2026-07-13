'use strict';

const service = require('./service');
const { success } = require('../../common/utils/response');

// -- STORE
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

// GET /api/grocery/stores 
async function listStores(req, res, next) {
  try {
    const { page, limit, category } = req.query;
    const result = await service.listStores({
      page:     page  ? parseInt(page, 10)  : 1,
      limit:    limit ? parseInt(limit, 10) : 20,
      category,
    });
    return success(res, 'Grocery stores retrieved', result);
  } catch (err) { next(err); }
}

// GET /api/grocery/stores/:id 
async function getStore(req, res, next) {
  try {
    const store = await service.getStore(req.params.id);
    return success(res, 'Grocery store retrieved', store);
  } catch (err) { next(err); }
}

// GET /api/grocery/seller/store 
async function getSellerStore(req, res, next) {
  try {
    const store = await service.getSellerStore(req.user.id);
    return success(res, 'Store profile retrieved', store);
  } catch (err) { next(err); }
}

// PATCH /api/grocery/stores/:storeId/toggle-open 
async function toggleStoreOpen(req, res, next) {
  try {
    const store = await service.toggleStoreOpen(req.params.storeId, req.user.id);
    return success(res, `Store is now ${store.isOpen ? 'open' : 'closed'}`, store);
  } catch (err) { next(err); }
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

// GET /api/grocery/stores/:id/products 
async function listStoreProducts(req, res, next) {
  try {
    const { page, limit, category, availableOnly } = req.query;
    const result = await service.listStoreProducts(req.params.id, {
      page:          page  ? parseInt(page, 10)  : 1,
      limit:         limit ? parseInt(limit, 10) : 20,
      category,
      availableOnly: availableOnly === 'true' || availableOnly === true,
    });
    return success(res, 'Products retrieved', result);
  } catch (err) { next(err); }
}

// GET /api/grocery/products/search 
async function searchProducts(req, res, next) {
  try {
    const { q, page, limit } = req.query;
    const result = await service.searchProducts(q, {
      page:  page  ? parseInt(page, 10)  : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return success(res, 'Search results', result);
  } catch (err) { next(err); }
}

// GET /api/grocery/products/:id 
async function getProduct(req, res, next) {
  try {
    const product = await service.getProduct(req.params.id);
    return success(res, 'Product retrieved', product);
  } catch (err) { next(err); }
}

// PATCH /api/grocery/products/:id/stock 
async function updateStock(req, res, next) {
  try {
    const { stock } = req.body;
    const product = await service.updateStock(req.params.id, req.user.id, stock);
    return success(res, 'Stock updated', product);
  } catch (err) { next(err); }
}


module.exports = {
  createStore,
  updateStore,
  createProduct,
  updateProduct,
  toggleProductAvailability,
  deleteProduct,
  listStores,
   getStore,
   getSellerStore,
   toggleStoreOpen,
   listStoreProducts,
   searchProducts,
   getProduct,
   updateStock,
};