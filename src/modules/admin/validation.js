'use strict';

const Joi = require('joi');

const analyticsSchema = Joi.object({
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});

module.exports = { analyticsSchema };
