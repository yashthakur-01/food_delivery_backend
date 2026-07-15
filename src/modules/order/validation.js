"use strict";

const Joi = require("joi");
const {
  CONFIRMED,
  PREPARING,
  OUT_FOR_DELIVERY,
  DELIVERED,
  CANCELLED,
} = require("../../common/constants/orderStatus");

const createOrderSchema = Joi.object({
  store_id: Joi.alternatives()
    .try(Joi.string().min(1), Joi.number().integer().positive())
    .required(),
  store_type: Joi.string().valid('restaurant', 'grocery').required(),
  address_id: Joi.alternatives()
    .try(Joi.string().min(1), Joi.number().integer().positive())
    .required(),
  items: Joi.array()
    .items(
      Joi.object({
        item_id: Joi.alternatives()
          .try(Joi.string().min(1), Joi.number().integer().positive())
          .required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(CONFIRMED, PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED)
    .required(),
});

const orderRequestSchema = {
  body: Joi.object({
    type: Joi.string().valid('REFUND','REPLACE').required(),
    store_type: Joi.string().valid('restaurant', 'grocery').required(),
    reason: Joi.string().trim().min(5).max(500).required(),

    image_url: Joi.string().uri().optional(),

    items: Joi.array()
      .items(
        Joi.object({
          item_id: Joi.string().required(),

          quantity: Joi.number().integer().min(1).required(),
        }),
      )
      .min(1)
      .required(),
  }),
};
module.exports = {
  createOrderSchema,
  updateOrderStatusSchema,
  orderRequestSchema,
};
