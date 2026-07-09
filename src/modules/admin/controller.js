'use strict';

const adminService = require('./service');
const { success } = require('../../common/utils/response');

const approveRestaurant = async (req, res, next) => {
  try {
    const restaurant = await adminService.approveRestaurant(req.params.id);
    return success(res, 'Restaurant approved', restaurant);
  } catch (err) {
    next(err);
  }
};

const approveDeliveryAgent = async (req, res, next) => {
  try {
    const agent = await adminService.approveDeliveryAgent(req.params.id);
    return success(res, 'Delivery agent approved', agent);
  } catch (err) {
    next(err);
  }
};

const approveStore = async (req, res, next) => {
  try{ 
    const store = await adminService.approveStore(req.params.id);
    return success(res, "store approved", store);
  } catch(err){
    next(err);
  }
}

const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getAnalytics(req.query);
    return success(res, 'Analytics retrieved', analytics);
  } catch (err) {
    next(err);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await adminService.getDashboard();

    return success(
      res,
      'Admin dashboard retrieved',
      dashboard
    );
  } catch (err) {
    next(err);
  }
};

const getPendingRestaurants = async (req, res, next) => {
  try{
    const pendingRestaurants = await adminService.getPendingRestaurants();
    return success(res, "Pending restaurants retrieved", pendingRestaurants);
  }catch (err){
    next(err);
  }
};

const getPendingDeliveryAgents = async (req, res, next) => {
  try{
    const pendingAgents = await adminService.getPendingDeliveryAgents();
    return success(res, "Pending delivery agents retrieved", pendingAgents);
  }catch (err){
    next(err);
  }
};

const getPendingStores = async (req, res, next) => {
  try{
    const pendingStores = await adminService.getPendingStores();
    return success(res, "Pending stores retrieved", pendingStores);
  }catch (err){
    next(err);
  }
};

module.exports = { approveRestaurant, approveDeliveryAgent, getAnalytics, getDashboard, approveStore, getPendingRestaurants, getPendingDeliveryAgents, getPendingStores };
