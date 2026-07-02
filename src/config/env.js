// const Joi = require("joi");

// const schema = Joi.object({
//   // DATABASE_URL: Joi.string().required(),
//   REDIS_URL: Joi.string().required(),
//   JWT_SECRET: Joi.string().required(),
//   JWT_REFRESH_SECRET: Joi.string().required(),
//   PORT: Joi.number().default(5000),
//   FCM_SERVER_KEY: Joi.string().allow("").optional(),
//   RAZORPAY_KEY_ID: Joi.string().allow("").optional(),
//   RAZORPAY_KEY_SECRET: Joi.string().allow("").optional(),
//   RAZORPAY_WEBHOOK_SECRET: Joi.string().allow("").optional(),
// }).unknown();

// const { error, value } = schema.validate(process.env);

// if (error) {
//   throw new Error(`Environment validation error: ${error.message}`);
// }

// module.exports = value;