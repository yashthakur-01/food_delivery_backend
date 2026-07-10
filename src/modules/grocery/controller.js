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

module.exports = {
  createStore,
  updateStore,
};