const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const overrideController = require('../controllers/overrideController');
const upload = require('../middleware/upload');

/**
 * @swagger
 * tags:
 *   name: Overrides
 *   description: Manual price override management
 */

/**
 * @swagger
 * /overrides:
 *   get:
 *     summary: Get all overrides
 *     tags: [Overrides]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of overrides
 */
router.get('/', authenticateToken, overrideController.getOverrides);

/**
 * @swagger
 * /overrides:
 *   post:
 *     summary: Create a new override
 *     tags: [Overrides]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               commodity_id:
 *                 type: integer
 *               price:
 *                 type: number
 *               evidence:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Override created
 */
router.post(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'editor'),
  upload.single('evidence'),
  overrideController.createOverride
);

/**
 * @swagger
 * /overrides/{id}/status:
 *   patch:
 *     summary: Approve or reject override
 *     tags: [Overrides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *     responses:
 *       200:
 *         description: Override status updated
 */
router.patch(
  '/:id/status',
  authenticateToken,
  authorizeRoles('admin'),
  overrideController.updateOverrideStatus
);

/**
 * @swagger
 * /overrides/{id}:
 *   delete:
 *     summary: Delete override
 *     tags: [Overrides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Override deleted
 */
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('admin'),
  overrideController.deleteOverride
);

module.exports = router;
