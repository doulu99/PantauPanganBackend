// routes/marketPriceRoutes.js - Updated version
const express = require('express');
const router = express.Router();
const marketPriceController = require('../controllers/marketPriceController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { body, validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

// Validation rules for market price
const marketPriceValidationRules = [
  body('commodity_id')
    .isInt({ min: 1 })
    .withMessage('Commodity ID must be a positive integer'),
    
  body('commodity_source')
    .optional()
    .isIn(['national', 'custom'])
    .withMessage('Commodity source must be either national or custom'),
    
  body('market_name')
    .notEmpty()
    .withMessage('Market name is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Market name must be between 2-255 characters')
    .trim(),
    
  body('market_location')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Market location must not exceed 255 characters')
    .trim(),
    
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),
    
  body('date')
    .isISO8601()
    .withMessage('Date must be in valid ISO format (YYYY-MM-DD)')
    .custom((value) => {
      const inputDate = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      if (inputDate > today) {
        throw new Error('Date cannot be in the future');
      }
      return true;
    }),
    
  body('quality_grade')
    .optional()
    .isIn(['premium', 'standard', 'economy'])
    .withMessage('Quality grade must be premium, standard, or economy'),
    
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
    .trim()
];

/**
 * @swagger
 * tags:
 *   name: Market Prices
 *   description: Market price data management including custom commodities
 */

/**
 * @swagger
 * /market-prices:
 *   get:
 *     summary: Get market prices with filtering
 *     tags: [Market Prices]
 *     parameters:
 *       - in: query
 *         name: commodity_id
 *         schema:
 *           type: integer
 *         description: Filter by commodity ID
 *       - in: query
 *         name: commodity_source
 *         schema:
 *           type: string
 *           enum: [national, custom]
 *         description: Filter by commodity source
 *       - in: query
 *         name: market_name
 *         schema:
 *           type: string
 *         description: Filter by market name
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by date (default today)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of market prices with pagination
 */
router.get('/', marketPriceController.getMarketPrices);

/**
 * @swagger
 * /market-prices/compare:
 *   get:
 *     summary: Compare market prices with national prices
 *     tags: [Market Prices]
 *     parameters:
 *       - in: query
 *         name: commodity_id
 *         schema:
 *           type: integer
 *         description: Filter by commodity ID
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date for comparison (default today)
 *     responses:
 *       200:
 *         description: Price comparison data
 */
router.get('/compare', marketPriceController.comparePrices);

/**
 * @swagger
 * /market-prices/trends:
 *   get:
 *     summary: Get price trends over time
 *     tags: [Market Prices]
 *     parameters:
 *       - in: query
 *         name: commodity_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Commodity ID
 *       - in: query
 *         name: commodity_source
 *         schema:
 *           type: string
 *           enum: [national, custom]
 *           default: national
 *         description: Commodity source
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (default 30 days ago)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (default today)
 *       - in: query
 *         name: market_name
 *         schema:
 *           type: string
 *         description: Filter by specific market
 *     responses:
 *       200:
 *         description: Price trend data
 */
router.get('/trends', marketPriceController.getPriceTrends);

/**
 * @swagger
 * /market-prices/stats:
 *   get:
 *     summary: Get market price statistics
 *     tags: [Market Prices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month]
 *           default: today
 *         description: Time period for statistics
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by commodity category
 *       - in: query
 *         name: market
 *         schema:
 *           type: string
 *         description: Filter by market name
 *     responses:
 *       200:
 *         description: Market price statistics
 */
router.get('/stats', authenticateToken, marketPriceController.getMarketStats);

// Protected routes (require authentication)
/**
 * @swagger
 * /market-prices:
 *   post:
 *     summary: Add new market price (supports custom commodities)
 *     tags: [Market Prices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - commodity_id
 *               - market_name
 *               - price
 *               - date
 *             properties:
 *               commodity_id:
 *                 type: integer
 *                 description: ID of commodity (national or custom)
 *               commodity_source:
 *                 type: string
 *                 enum: [national, custom]
 *                 default: national
 *                 description: Source type of commodity
 *               market_name:
 *                 type: string
 *                 description: Name of the market
 *               market_location:
 *                 type: string
 *                 description: Location of the market
 *               price:
 *                 type: number
 *                 description: Price value
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date of price record
 *               quality_grade:
 *                 type: string
 *                 enum: [premium, standard, economy]
 *                 default: standard
 *                 description: Quality grade of commodity
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *               evidence:
 *                 type: string
 *                 format: binary
 *                 description: Evidence photo (optional)
 *     responses:
 *       201:
 *         description: Market price created successfully
 *       400:
 *         description: Validation error or commodity not found
 *       401:
 *         description: Authentication required
 */
router.post('/', 
  authenticateToken,
  upload.single('evidence'),
  marketPriceValidationRules,
  handleValidationErrors,
  marketPriceController.addMarketPrice
);

/**
 * @swagger
 * /market-prices/{id}:
 *   put:
 *     summary: Update market price
 *     tags: [Market Prices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Market price ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               market_name:
 *                 type: string
 *               market_location:
 *                 type: string
 *               price:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date
 *               quality_grade:
 *                 type: string
 *                 enum: [premium, standard, economy]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Market price updated successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Market price not found
 */
router.put('/:id',
  authenticateToken,
  [
    body('market_name')
      .optional()
      .isLength({ min: 2, max: 255 })
      .withMessage('Market name must be between 2-255 characters')
      .trim(),
    body('price')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Price must be a positive number'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Date must be in valid ISO format'),
    body('quality_grade')
      .optional()
      .isIn(['premium', 'standard', 'economy'])
      .withMessage('Quality grade must be premium, standard, or economy')
  ],
  handleValidationErrors,
  marketPriceController.updateMarketPrice
);

/**
 * @swagger
 * /market-prices/{id}:
 *   delete:
 *     summary: Delete market price
 *     tags: [Market Prices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Market price ID
 *     responses:
 *       200:
 *         description: Market price deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Market price not found
 */
router.delete('/:id', 
  authenticateToken, 
  marketPriceController.deleteMarketPrice
);

module.exports = router;