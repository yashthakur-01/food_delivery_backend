'use strict';

const Joi = require('joi');

const createStoreSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  description: Joi.string().trim().max(1000).optional(),
  address: Joi.string().trim().min(3).required(),
  email: Joi.string().email().lowercase().trim().optional(),
  phone: Joi.string().trim().optional(),
  storeType: Joi.string()
    .valid('GROCERY', 'CLOTHING', 'ELECTRONICS', 'OTHER')
    .optional(),
  category: Joi.string().trim().optional(),
  imageUrl: Joi.string().uri().optional(),
  bannerUrl: Joi.string().uri().optional(),
  deliveryFee: Joi.number().min(0).optional(),
  minOrderAmount: Joi.number().min(0).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  isOpen: Joi.boolean().optional(),
  offerTag: Joi.string().trim().optional(),
  workingHours: Joi.object().optional(),
});

const updateStoreSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).optional(),
  description: Joi.string().trim().max(1000).optional(),
  address: Joi.string().trim().min(3).optional(),
  email: Joi.string().email().lowercase().trim().optional(),
  phone: Joi.string().trim().optional(),
  storeType: Joi.string()
    .valid('GROCERY', 'CLOTHING', 'ELECTRONICS', 'OTHER')
    .optional(),
  category: Joi.string().trim().optional(),
  imageUrl: Joi.string().uri().optional(),
  bannerUrl: Joi.string().uri().optional(),
  deliveryFee: Joi.number().min(0).optional(),
  minOrderAmount: Joi.number().min(0).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  isOpen: Joi.boolean().optional(),
  offerTag: Joi.string().trim().optional(),
  workingHours: Joi.object().optional(),
}).min(1);

module.exports = {
  createStoreSchema,
  updateStoreSchema,
};