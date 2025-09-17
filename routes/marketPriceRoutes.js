const express = require('express');
const router = express.Router();
const marketPriceController = require('../controllers/marketPriceController');

// Public routes
router.get('/', marketPriceController.getMarketPrices);
router.get('/compare', marketPriceController.comparePrices);
router.get('/trends', marketPriceController.getPriceTrends);

// Protected routes (add auth middleware later)
router.post('/', marketPriceController.addMarketPrice);

module.exports = router;