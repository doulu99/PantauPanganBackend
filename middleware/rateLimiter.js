// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

const limiters = {
  // General API rate limit
  api: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many API requests'
  ),
  
  // Strict limit for auth endpoints
  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // limit each IP to 5 requests per windowMs
    'Too many authentication attempts'
  ),
  
  // Moderate limit for price sync
  sync: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    10, // limit each IP to 10 sync requests per hour
    'Too many sync requests'
  )
};

module.exports = limiters;