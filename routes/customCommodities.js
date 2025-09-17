// routes/customCommodities.js
const express = require('express');
const router = express.Router();
const customCommodityController = require('../controllers/customCommodityController');
const { authenticateToken } = require('../middleware/auth');
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

// Validation rules
const commodityValidationRules = [
  body('name')
    .notEmpty()
    .withMessage('Nama komoditas wajib diisi')
    .isLength({ min: 2, max: 255 })
    .withMessage('Nama komoditas harus antara 2-255 karakter')
    .trim(),
  
  body('unit')
    .notEmpty()
    .withMessage('Satuan wajib diisi')
    .isLength({ max: 50 })
    .withMessage('Satuan maksimal 50 karakter')
    .trim(),
  
  body('category')
    .notEmpty()
    .withMessage('Kategori wajib dipilih')
    .isIn(['beras', 'sayuran', 'buah', 'daging', 'ikan', 'bumbu', 'telur', 'kacang', 'minyak', 'lainnya'])
    .withMessage('Kategori tidak valid'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Deskripsi maksimal 1000 karakter')
    .trim()
];

// Routes with proper middleware chaining

// GET /api/commodities/custom - Get all custom commodities
router.get('/', authenticateToken, customCommodityController.getCustomCommodities);

// GET /api/commodities/custom/stats - Get commodity statistics
router.get('/stats', authenticateToken, customCommodityController.getCustomCommodityStats);

// GET /api/commodities/custom/:id - Get single custom commodity
router.get('/:id', authenticateToken, customCommodityController.getCustomCommodityById);

// POST /api/commodities/custom - Create new custom commodity
router.post('/', [
  authenticateToken,
  ...commodityValidationRules,
  handleValidationErrors
], customCommodityController.createCustomCommodity);

// PUT /api/commodities/custom/:id - Update custom commodity
router.put('/:id', [
  authenticateToken,
  ...commodityValidationRules,
  handleValidationErrors
], customCommodityController.updateCustomCommodity);

// DELETE /api/commodities/custom/:id - Delete custom commodity
router.delete('/:id', authenticateToken, customCommodityController.deleteCustomCommodity);

module.exports = router;