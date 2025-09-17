const express = require('express');
const router = express.Router();
const regionController = require('../controllers/regionController');

/**
 * @swagger
 * tags:
 *   name: Regions
 *   description: Region (province/city) data
 */

/**
 * @swagger
 * /regions/provinces:
 *   get:
 *     summary: Get all provinces
 *     tags: [Regions]
 *     responses:
 *       200:
 *         description: List of provinces
 */
router.get('/provinces', regionController.getProvinces);

/**
 * @swagger
 * /regions/cities/{provinceId}:
 *   get:
 *     summary: Get cities by province
 *     tags: [Regions]
 *     parameters:
 *       - in: path
 *         name: provinceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of cities in province
 */
router.get('/cities/:provinceId', regionController.getCities);

/**
 * @swagger
 * /regions/all:
 *   get:
 *     summary: Get all regions (provinces and cities)
 *     tags: [Regions]
 *     responses:
 *       200:
 *         description: List of all regions
 */
router.get('/all', regionController.getAllRegions);

module.exports = router;
