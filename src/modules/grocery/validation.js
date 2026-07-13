'use strict';

const Joi = require('joi');

// Store - POST /api/grocery/stores
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

//PUT - /api/grocery/stores/:storeId
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

// Product
// POST /api/grocery/products - seller adds a product
const createProductSchema = Joi.object({
  storeId: Joi.string().trim().length(24).required(),
  name: Joi.string().trim().min(1).max(150).required(),
  description: Joi.string().trim().max(500).optional(),
  category: Joi.string().trim().max(80).optional(),
  brand: Joi.string().trim().max(80).optional(),
  price: Joi.number().positive().required(),
  originalPrice: Joi.number().positive().optional(),
  unit: Joi.string().trim().max(20).optional(),
  quantity: Joi.number().positive().optional(),
  imageUrl: Joi.string().trim().uri().optional(),
  stock: Joi.number().integer().min(0).default(0),
  isAvailable: Joi.boolean().default(true),
});

// PATCH /api/grocery/products/:id — seller updates a ptoduct
const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150),
  description: Joi.string().trim().max(500).allow('', null),
  category: Joi.string().trim().max(80).allow('', null),
  brand: Joi.string().trim().max(80).allow('', null),
  price: Joi.number().positive(),
  originalPrice: Joi.number().positive().allow(null),
  unit: Joi.string().trim().max(20).allow('', null),
  quantity: Joi.number().positive().allow(null),
  imageUrl: Joi.string().trim().uri().allow('', null),
  isAvailable: Joi.boolean(),
}).min(1);

//stockschema is required !!!!!!! here
// PATCH - /api/grocery/products/:id/stock -> this will update the stock level
const updateStockSchema = Joi.object({
  stock: Joi.number().integer().min(0).required(),
});

// GET - /api/grocery/stores -> this is for listing the stores
const listStoresSchema = Joi.object({
  page:     Joi.number().integer().min(1).default(1),
  limit:    Joi.number().integer().min(1).max(100).default(20),
  category: Joi.string().trim().optional(),
});

// GET /api/grocery/stores/:id/products — this is for listing the products
const listProductsSchema = Joi.object({
  page:          Joi.number().integer().min(1).default(1),
  limit:         Joi.number().integer().min(1).max(100).default(20),
  category:      Joi.string().trim().optional(),
  availableOnly: Joi.boolean().optional(),
});

// GET /api/grocery/products/search — for searching products 
const searchProductsSchema = Joi.object({
  q:     Joi.string().trim().min(1).required(),
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createStoreSchema,
  updateStoreSchema,
  createProductSchema,
  updateProductSchema,
  updateStockSchema,
  listStoresSchema,
  listProductsSchema,
  searchProductsSchema,
};