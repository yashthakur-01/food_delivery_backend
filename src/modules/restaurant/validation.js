'use strict';

const Joi = require('joi');

const listRestaurantsSchema = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const addMenuItemSchema = Joi.object({
  name:         Joi.string().trim().min(1).max(100).required(),
  price:        Joi.number().positive().required(),
  category:     Joi.string().trim().min(1).max(50).required(),
  is_available: Joi.boolean().default(true),
});

const updateMenuItemSchema = Joi.object({
  name:         Joi.string().trim().min(1).max(100),
  price:        Joi.number().positive(),
  category:     Joi.string().trim().min(1).max(50),
  is_available: Joi.boolean(),
}).min(1); // at least one field required


module.exports = { listRestaurantsSchema, addMenuItemSchema, updateMenuItemSchema };
