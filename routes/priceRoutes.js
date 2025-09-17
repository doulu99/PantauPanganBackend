const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const priceController = require('../controllers/priceController');

/**
 * @swagger
 * tags:
 *   name: Prices
 *   description: Commodity price data and statistics
 */

/**
 * @swagger
 * /prices/current:
 *   get:
 *     summary: Get current prices
 *     tags: [Prices]
 *     responses:
 *       200:
 *         description: Current prices
 */
router.get('/current', priceController.getCurrentPrices);

/**
 * @swagger
 * /prices/history/{commodityId}:
 *   get:
 *     summary: Get price history for a commodity
 *     tags: [Prices]
 *     parameters:
 *       - in: path
 *         name: commodityId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Price history
 */
router.get('/history/:commodityId', priceController.getPriceHistory);

/**
 * @swagger
 * /prices/comparison:
 *   get:
 *     summary: Get price comparison (API vs Manual)
 *     tags: [Prices]
 *     responses:
 *       200:
 *         description: Price comparison
 */
router.get('/comparison', priceController.getPriceComparison);

/**
 * @swagger
 * /prices/statistics:
 *   get:
 *     summary: Get price statistics
 *     tags: [Prices]
 *     responses:
 *       200:
 *         description: Price statistics
 */
router.get('/statistics', priceController.getPriceStatistics);

/**
 * @swagger
 * /prices/sync:
 *   post:
 *     summary: Trigger manual sync of prices from API
 *     tags: [Prices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync started
 */
router.post(
  '/sync',
  authenticateToken,
  authorizeRoles('admin'),
  priceController.syncPrices
);

/**
 * @swagger
 * /prices/export:
 *   get:
 *     summary: Export prices as CSV/Excel
 *     tags: [Prices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export file
 */
router.get('/export', authenticateToken, priceController.exportPrices);

module.exports = router;
