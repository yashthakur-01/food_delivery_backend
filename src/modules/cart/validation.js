'use strict';

const Joi = require('joi');

const addItemSchema = Joi.object({
  item_id: Joi.string().min(1).required(),
  store_type: Joi.string().valid('restaurant', 'grocery').required(),
  quantity: Joi.number().integer().min(1).required(),
});

const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

const checkoutSchema = Joi.object({
  address_id: Joi.string().min(1).required(),
});

module.exports = { addItemSchema, updateItemSchema, checkoutSchema };
