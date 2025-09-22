// routes/debugRoutes.js
const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');

// Test database connection
router.get('/test-db', debugController.testDatabase);

// Check data count
router.get('/check-data', debugController.checkData);

// Add sample data
router.post('/add-sample-data', debugController.addSampleData);

// Test BPN API
router.get('/test-bpn-api', debugController.testBPNApi);

// Force BPN sync
router.post('/force-sync', debugController.forceBPNSync);

module.exports = router;