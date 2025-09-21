// routes/marketPriceRoutes.js - ENHANCED WITH IMAGE SUPPORT
const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const path = require('path');

// Import controller with error handling
let marketPriceController;
try {
  marketPriceController = require('../controllers/marketPriceController');
  console.log('✅ MarketPrice controller loaded successfully');
} catch (error) {
  console.error('❌ Failed to load MarketPrice controller:', error.message);
  marketPriceController = {
    getMarketPrices: (req, res) => res.status(501).json({ success: false, message: 'Controller not available' }),
    addMarketPrice: (req, res) => res.status(501).json({ success: false, message: 'Controller not available' }),
    updateMarketPrice: (req, res) => res.status(501).json({ success: false, message: 'Controller not available' }),
    deleteMarketPrice: (req, res) => res.status(501).json({ success: false, message: 'Controller not available' }),
    getMarketStats: (req, res) => res.status(501).json({ success: false, message: 'Controller not available' }),
    comparePrices: (req, res) => res.status(501).json({ success: false, message: 'Controller not available' })
  };
}

// Import middleware with fallback
let authenticateToken;
try {
  const authMiddleware = require('../middleware/auth');
  authenticateToken = authMiddleware.authenticateToken || authMiddleware;
} catch (error) {
  console.warn('⚠️ Auth middleware not available, using passthrough');
  authenticateToken = (req, res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  };
}

// Import upload middleware
let uploadSingle, uploadMultiple, handleUploadError;
try {
  const uploadMiddleware = require('../middleware/upload');
  uploadSingle = uploadMiddleware.uploadSingle;
  uploadMultiple = uploadMiddleware.uploadMultiple;
  handleUploadError = uploadMiddleware.handleUploadError;
} catch (error) {
  console.warn('⚠️ Upload middleware not available, using passthrough');
  uploadSingle = (req, res, next) => next();
  uploadMultiple = (req, res, next) => next();
  handleUploadError = (req, res, next) => next();
}

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Error handling middleware
const errorHandler = (error, req, res, next) => {
  console.error('Route Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  if (error.name === 'SequelizeDatabaseError') {
    return res.status(500).json({
      success: false,
      message: 'Database error occurred',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
  
  res.status(error.statusCode || error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
};

// Validation rules
const marketPriceValidationRules = [
  body('commodity_id').notEmpty().isInt({ min: 1 }).withMessage('Commodity ID is required'),
  body('commodity_source').optional().isIn(['national', 'custom']).withMessage('Invalid commodity source'),
  body('market_name').notEmpty().isLength({ min: 2, max: 255 }).withMessage('Market name is required').trim(),
  body('market_location').optional().isLength({ max: 255 }).withMessage('Location too long').trim(),
  body('price').notEmpty().isFloat({ min: 0.01 }).withMessage('Valid price is required'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('quality_grade').optional().isIn(['premium', 'standard', 'economy']).withMessage('Invalid quality grade'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes too long').trim()
];

const updateValidationRules = [
  body('market_name').optional().isLength({ min: 2, max: 255 }).withMessage('Invalid market name').trim(),
  body('market_location').optional().isLength({ max: 255 }).withMessage('Location too long').trim(),
  body('price').optional().isFloat({ min: 0.01 }).withMessage('Invalid price'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('quality_grade').optional().isIn(['premium', 'standard', 'economy']).withMessage('Invalid quality grade'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes too long').trim(),
  body('remove_images').optional().isArray().withMessage('remove_images must be an array'),
  body('remove_images.*').optional().isString().withMessage('Each remove_images item must be a string')
];

// ==================== STATIC FILE SERVING ====================

/**
 * Serve uploaded images
 */
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ==================== MAIN ROUTES ====================

/**
 * @swagger
 * /market-prices:
 *   get:
 *     summary: Get market prices with images
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
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month]
 *         description: Time period filter
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
 *         description: List of market prices with images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       commodity_id:
 *                         type: integer
 *                       commodity_source:
 *                         type: string
 *                       market_name:
 *                         type: string
 *                       market_location:
 *                         type: string
 *                       price:
 *                         type: number
 *                       date:
 *                         type: string
 *                       quality_grade:
 *                         type: string
 *                       notes:
 *                         type: string
 *                       evidence_url:
 *                         type: string
 *                         description: Main image URL
 *                       images:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             url:
 *                               type: string
 *                             filename:
 *                               type: string
 *                             type:
 *                               type: string
 *                               enum: [evidence, additional]
 *                       commodity:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           unit:
 *                             type: string
 *                           category:
 *                             type: string
 *                           source:
 *                             type: string
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res, next) => {
  try {
    await marketPriceController.getMarketPrices(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /market-prices/stats:
 *   get:
 *     summary: Get market price statistics
 *     tags: [Market Prices]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month]
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
 *       500:
 *         description: Internal server error
 */
router.get('/stats', async (req, res, next) => {
  try {
    await marketPriceController.getMarketStats(req, res);
  } catch (error) {
    next(error);
  }
});

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
 *       500:
 *         description: Internal server error
 */
router.get('/compare', async (req, res, next) => {
  try {
    await marketPriceController.comparePrices(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /market-prices:
 *   post:
 *     summary: Add new market price with image support
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
 *             properties:
 *               commodity_id:
 *                 type: integer
 *                 description: ID of the commodity
 *               commodity_source:
 *                 type: string
 *                 enum: [national, custom]
 *                 description: Source of the commodity
 *               market_name:
 *                 type: string
 *                 description: Name of the market
 *               market_location:
 *                 type: string
 *                 description: Location of the market
 *               price:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *                 description: Price per unit
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date of the price (default today)
 *               quality_grade:
 *                 type: string
 *                 enum: [premium, standard, economy]
 *                 default: standard
 *                 description: Quality grade of the commodity
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Additional notes
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Main evidence image (single upload)
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Multiple images (up to 5)
 *     responses:
 *       201:
 *         description: Market price added successfully with images
 *       400:
 *         description: Validation error or file upload error
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/',
  authenticateToken,
  uploadMultiple, // Support multiple image uploads
  handleUploadError,
  marketPriceValidationRules,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await marketPriceController.addMarketPrice(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /market-prices/upload-single:
 *   post:
 *     summary: Add new market price with single image
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
 *             properties:
 *               commodity_id:
 *                 type: integer
 *               commodity_source:
 *                 type: string
 *                 enum: [national, custom]
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
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Single image upload
 *     responses:
 *       201:
 *         description: Market price added successfully with single image
 */
router.post('/upload-single',
  authenticateToken,
  uploadSingle, // Single image upload
  handleUploadError,
  marketPriceValidationRules,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await marketPriceController.addMarketPrice(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /market-prices/{id}:
 *   put:
 *     summary: Update market price with image support
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               market_name:
 *                 type: string
 *               market_location:
 *                 type: string
 *               price:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *               date:
 *                 type: string
 *                 format: date
 *               quality_grade:
 *                 type: string
 *                 enum: [premium, standard, economy]
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: New main image (replaces existing)
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Additional images to add
 *               remove_images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of image filenames to remove
 *     responses:
 *       200:
 *         description: Market price updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Market price not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
  uploadMultiple, // Support multiple image uploads for updates
  handleUploadError,
  updateValidationRules,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await marketPriceController.updateMarketPrice(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /market-prices/{id}:
 *   delete:
 *     summary: Delete market price and associated images
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
 *         description: Market price and images deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Market price not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', 
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await marketPriceController.deleteMarketPrice(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /market-prices/{id}/images:
 *   post:
 *     summary: Add images to existing market price
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Images to add (up to 5)
 *     responses:
 *       200:
 *         description: Images added successfully
 *       400:
 *         description: Upload error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Market price not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/images',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
  uploadMultiple,
  handleUploadError,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // This is essentially an update operation with only images
      req.body = { ...req.body }; // Keep existing data
      await marketPriceController.updateMarketPrice(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /market-prices/{id}/images/{filename}:
 *   delete:
 *     summary: Delete specific image from market price
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
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Image filename to delete
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Market price or image not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/images/:filename',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
  param('filename').isString().withMessage('Invalid filename'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // Set remove_images in body for update operation
      req.body = { 
        remove_images: [req.params.filename]
      };
      await marketPriceController.updateMarketPrice(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== HELPER ENDPOINTS ====================

/**
 * @swagger
 * /market-prices/markets:
 *   get:
 *     summary: Get list of unique markets
 *     tags: [Market Prices]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search market names
 *     responses:
 *       200:
 *         description: List of markets
 */
router.get('/markets', async (req, res, next) => {
  try {
    const { MarketPrice } = require('../models');
    const { Op } = require('sequelize');
    const { search, limit = 50 } = req.query;
    
    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { market_name: { [Op.like]: `%${search}%` } },
        { market_location: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const markets = await MarketPrice.findAll({
      where: whereClause,
      attributes: [
        'market_name',
        'market_location',
        [require('sequelize').fn('COUNT', 'id'), 'count']
      ],
      group: ['market_name', 'market_location'],
      order: [
        [require('sequelize').fn('COUNT', 'id'), 'DESC'],
        ['market_name', 'ASC']
      ],
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: markets.map(market => ({
        name: market.market_name,
        location: market.market_location,
        count: parseInt(market.dataValues.count)
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /market-prices/{id}:
 *   get:
 *     summary: Get single market price by ID with images
 *     tags: [Market Prices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Market price ID
 *     responses:
 *       200:
 *         description: Market price details with images
 *       404:
 *         description: Market price not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // Set pagination to get single item
      req.query = { 
        ...req.query,
        limit: 1,
        page: 1
      };
      
      // Modify where clause to include specific ID
      const originalController = marketPriceController.getMarketPrices;
      
      // Temporarily modify the controller to filter by ID
      marketPriceController.getMarketPrices = async (req, res) => {
        const { MarketPrice, Commodity, DataSource, User, CustomCommodity } = require('../models');
        const { getImageUrl } = require('../middleware/upload');
        
        const marketPrice = await MarketPrice.findByPk(req.params.id, {
          include: [
            {
              model: DataSource,
              required: false,
              attributes: ['id', 'name', 'type', 'location']
            },
            {
              model: User,
              as: 'reporter',
              required: false,
              attributes: ['id', 'full_name', 'username']
            }
          ]
        });
        
        if (!marketPrice) {
          return res.status(404).json({
            success: false,
            message: 'Market price not found'
          });
        }
        
        // Get commodity info with smart detection
        let commodity = null;
        let actualCommoditySource = marketPrice.commodity_source;
        
        let customCommodity = null;
        let nationalCommodity = null;

        if (CustomCommodity) {
          customCommodity = await CustomCommodity.findByPk(marketPrice.commodity_id, {
            attributes: ['id', 'name', 'unit', 'category', 'description'],
            where: { is_active: true }
          });
        }

        if (Commodity) {
          nationalCommodity = await Commodity.findByPk(marketPrice.commodity_id, {
            attributes: ['id', 'name', 'unit', 'category']
          });
        }

        // Priority logic
        if (customCommodity && nationalCommodity) {
          commodity = customCommodity;
          actualCommoditySource = 'custom';
        } else if (customCommodity) {
          commodity = customCommodity;
          actualCommoditySource = 'custom';
        } else if (nationalCommodity) {
          commodity = nationalCommodity;
          actualCommoditySource = 'national';
        } else {
          commodity = {
            id: marketPrice.commodity_id,
            name: 'Commodity Not Found',
            unit: 'kg',
            category: 'lainnya'
          };
        }
        
        // Process images
        let images = [];
        if (marketPrice.evidence_url) {
          const imageUrl = getImageUrl(req, path.basename(marketPrice.evidence_url));
          if (imageUrl) {
            images.push({
              url: imageUrl,
              filename: path.basename(marketPrice.evidence_url),
              type: 'evidence'
            });
          }
        }

        if (marketPrice.images) {
          try {
            const imageList = typeof marketPrice.images === 'string' 
              ? JSON.parse(marketPrice.images) 
              : marketPrice.images;
              
            if (Array.isArray(imageList)) {
              imageList.forEach(imagePath => {
                const imageUrl = getImageUrl(req, path.basename(imagePath));
                if (imageUrl) {
                  images.push({
                    url: imageUrl,
                    filename: path.basename(imagePath),
                    type: 'additional'
                  });
                }
              });
            }
          } catch (parseError) {
            console.warn(`⚠️ Could not parse images for price ${marketPrice.id}:`, parseError.message);
          }
        }
        
        const response = {
          ...marketPrice.toJSON(),
          commodity_source: actualCommoditySource,
          commodity: {
            ...commodity,
            source: actualCommoditySource
          },
          images,
          evidence_url: marketPrice.evidence_url ? getImageUrl(req, path.basename(marketPrice.evidence_url)) : null
        };
        
        res.json({
          success: true,
          data: response
        });
      };
      
      await marketPriceController.getMarketPrices(req, res);
      
      // Restore original controller
      marketPriceController.getMarketPrices = originalController;
      
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

module.exports = router;