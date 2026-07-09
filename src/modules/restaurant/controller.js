'use strict';

const service = require('./service');
const { success } = require('../../common/utils/response');

/** GET /restaurants */
async function listRestaurants(req, res, next) {
  try {
    const { page, limit, category } = req.query;
    const result = await service.listRestaurants({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      category,
    });
    return success(res, 'Restaurants retrieved', result);
  } catch (err) { next(err); }
}

/** GET /restaurants/categories */
async function getCategories(req, res, next) {
  try {
    const categories = await service.getCategories();
    return success(res, 'Categories retrieved', categories);
  } catch (err) { next(err); }
}

/** GET /restaurants/banners */
async function getBanners(req, res, next) {
  try {
    const banners = await service.getBanners();
    return success(res, 'Banners retrieved', banners);
  } catch (err) { next(err); }
}

/** GET /restaurants/search */
async function searchRestaurants(req, res, next) {
  try {
    const { q, page, limit } = req.query;
    const result = await service.searchRestaurants(q, req.user?.id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return success(res, 'Search results', result);
  } catch (err) { next(err); }
}

/** GET /restaurants/search/history */
async function getSearchHistory(req, res, next) {
  try {
    const history = await service.getSearchHistory(req.user.id);
    return success(res, 'Search history retrieved', history);
  } catch (err) { next(err); }
}

/** DELETE /restaurants/search/history/:id */
async function deleteSearchEntry(req, res, next) {
  try {
    await service.deleteSearchEntry(req.user.id, req.params.id);
    return success(res, 'Search entry deleted', null);
  } catch (err) { next(err); }
}

/** DELETE /restaurants/search/history */
async function clearSearchHistory(req, res, next) {
  try {
    await service.clearSearchHistory(req.user.id);
    return success(res, 'Search history cleared', null);
  } catch (err) { next(err); }
}

/** GET /restaurants/:id */
async function getRestaurantDetails(req, res, next) {
  try {
    const restaurant = await service.getRestaurantDetails(req.params.id);
    return success(res, 'Restaurant retrieved', restaurant);
  } catch (err) { next(err); }
}

/** POST /restaurants/:id/menu */
async function addMenuItem(req, res, next) {
  try {
    const item = await service.addMenuItem(req.params.id, req.user.id, req.body);
    return success(res, 'Menu item added', item, 201);
  } catch (err) { next(err); }
}

/** PATCH /restaurants/:id/menu/:itemId */
async function updateMenuItem(req, res, next) {
  try {
    const item = await service.updateMenuItem(req.params.id, req.params.itemId, req.user.id, req.body);
    return success(res, 'Menu item updated', item);
  } catch (err) { next(err); }
}

/** GET /restaurants/replace/:id */
async function getOrderRequest(req, res, next){
  try{
    const request = await service.getOrderRequest(req.params.id, req.user.id);
    return success(res, 'Order request retrieved', request);
  }catch(err){ next(err); }
}

async function updateOrderRequest(req,res,next){
  try{
    const result = await service.updateOrderRequest(
      req.params.id,
      req.user.id,
      req.body.status
    );
    return success(res, 'Order request updated', result);
  }catch(err){ next(err); }
}

module.exports = {
  listRestaurants, getCategories, getBanners, searchRestaurants,
  getSearchHistory, deleteSearchEntry, clearSearchHistory,
  getRestaurantDetails, addMenuItem, updateMenuItem,
  getOrderRequest,
  updateOrderRequest,
};
