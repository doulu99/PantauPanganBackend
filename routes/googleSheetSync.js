// ==========================================
// 2. routes/googleSheetSync.js
// ==========================================
const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const googleSheetsService = require('../services/googleSheetsService');

const router = express.Router();

// Manual sync trigger (Admin only)
router.post('/sync', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    console.log(`🔄 Manual sync triggered by: ${req.user.username}`);
    
    const result = await googleSheetsService.syncToDatabase();
    
    res.json({
      success: true,
      message: 'Google Sheet sync completed',
      data: result
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Sync failed',
      error: error.message
    });
  }
});

// Test tanpa auth - HANYA UNTUK DEBUGGING
router.get('/test-simple', async (req, res) => {
  res.json({
    success: true,
    message: 'Google Sheets route is working'
  });
});

// Get sheet info (Admin only)
router.get('/info', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const info = await googleSheetsService.getSheetInfo();
    
    res.json({
      success: true,
      message: 'Sheet info retrieved',
      data: info
    });
  } catch (error) {
    console.error('Get sheet info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sheet info',
      error: error.message
    });
  }
});

// Test connection (Admin only)
router.get('/test', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const data = await googleSheetsService.fetchSheetData();
    
    res.json({
      success: true,
      message: 'Connection test successful',
      data: {
        total_rows: data.length,
        sample_data: data.slice(0, 3) // Show first 3 rows as sample
      }
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Connection test failed',
      error: error.message
    });
  }
});

// Get sync status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const SembakoPrice = require('../models/SembakoPrice');
    
    const stats = await SembakoPrice.findAll({
      attributes: [
        'source',
        [SembakoPrice.sequelize.fn('COUNT', SembakoPrice.sequelize.col('id')), 'count'],
        [SembakoPrice.sequelize.fn('MAX', SembakoPrice.sequelize.col('createdAt')), 'latest_sync']
      ],
      where: {
        source: 'google_sheet'
      },
      group: ['source'],
      raw: true
    });

    res.json({
      success: true,
      message: 'Sync status retrieved',
      data: {
        google_sheet_records: stats.length > 0 ? parseInt(stats[0].count) : 0,
        last_sync: stats.length > 0 ? stats[0].latest_sync : null,
        config: {
          sheet_id: process.env.GOOGLE_SHEET_ID,
          range: process.env.GOOGLE_SHEET_RANGE,
          sync_interval: process.env.SYNC_INTERVAL_HOURS || 6
        }
      }
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
      error: error.message
    });
  }
});

module.exports = router;