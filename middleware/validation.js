// middleware/validation.js
const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
};

// Validation schemas
const schemas = {
  createOverride: Joi.object({
    commodity_id: Joi.number().required(),
    date: Joi.date().iso(),
    override_price: Joi.number().positive().required(),
    reason: Joi.string().min(10).required(),
    source_info: Joi.string(),
    region_id: Joi.number()
  }),
  
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    full_name: Joi.string().min(3).required(),
    role: Joi.string().valid('admin', 'editor', 'viewer')
  }),
  
  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  })
};

module.exports = {
  validateRequest,
  schemas
};
