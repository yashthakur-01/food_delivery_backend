'use strict';

const service = require('./service');
const { success } = require('../../common/utils/response');

/** POST /orders */
async function createOrder(req, res, next) {
  try {
    const order = await service.createOrder(req.user.id, req.body);
    return success(res, 'Order created', order, 201);
  } catch (err) { next(err); }
}

/** GET /orders */
async function getOrders(req, res, next) {
  try {
    const { page, limit, tab, type } = req.query;
    const result = await service.getOrders(req.user.id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      tab,
      type
    });
    return success(res, 'Orders retrieved', result);
  } catch (err) { next(err); }
}

/** POST /orders/:id/cancel */
async function cancelOrder(req, res, next) {
  try {
    const order = await service.cancelOrder(req.params.id, req.user.id);
    return success(res, 'Order cancelled', order);
  } catch (err) { next(err); }
}

/** PATCH /orders/:id/status */
async function updateOrderStatus(req, res, next) {
  try {
    const io = req.app.get('io');

    const order = await service.updateOrderStatus(
      req.params.id,
      req.body.status,
      req.user,
      io
    );

    return success(res, 'Order status updated', order);
  } catch (err) {
    next(err);
  }
}

/**POST /orders/:id/request */
async function createOrderRequest(req, res, next){
  try{
    const io = req.app.get('io');

    const request = await service.createOrderRequest(
      req.params.id,
      req.user.id,
      req.body,
      io
    );

    return success(res, 'Order request created', request, 201);
  }catch(err){
    next(err);
  }
}

//Order tracking
async function getOrderTracking(req, res, next) {
  try {
    const tracking = await service.getOrderTracking(
      req.params.id,
      req.user
    );

    return success(
      res,
      "Tracking retrieved successfully",
      tracking
    );
  } catch (err) {
    next(err);
  }
}

/** GET /orders/requests/:id - Unified endpoint for restaurant and grocery owners */
async function getOrderRequestForOwner(req, res, next) {
  try {
    const orderRequest = await service.getOrderRequestForOwner(
      req.params.id,
      req.user.id
    );

    return success(res, 'Order request retrieved', orderRequest);
  } catch (err) {
    next(err);
  }
}

/** PATCH /orders/requests/:id - Unified endpoint for updating order requests */
async function updateOrderRequestForOwner(req, res, next) {
  try {
    const result = await service.updateOrderRequestForOwner(
      req.params.id,
      req.user.id,
      req.body.status
    );

    return success(res, 'Order request updated', result);
  } catch (err) {
    next(err);
  }
}

module.exports = { 
  createOrder, getOrders, cancelOrder, updateOrderStatus, createOrderRequest, getOrderTracking,
  getOrderRequestForOwner, updateOrderRequestForOwner
};
