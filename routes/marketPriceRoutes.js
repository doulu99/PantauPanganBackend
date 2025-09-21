// routes/marketPriceRoutes.js
const express = require('express');
const router = express.Router();

// Import controller functions (akan kita buat/update)
let marketPriceController;
try {
  marketPriceController = require('../controllers/marketPriceController');
} catch (error) {
  console.warn('⚠️ MarketPriceController not found, using fallback');
  marketPriceController = {
    uploadImage: (req, res, next) => next(),
    getMarketPrices: async (req, res) => {
      res.json({
        success: true,
        data: {
          prices: [],
          pagination: {
            current_page: 1,
            total_pages: 0,
            total_records: 0,
            per_page: 20
          }
        }
      });
    },
    addMarketPrice: async (req, res) => {
      res.status(501).json({
        success: false,
        message: 'Market price controller not implemented yet'
      });
    },
    getProvinces: async (req, res) => {
      try {
        // Fallback data provinsi
        const provinces = [
          { id: 1, province_name: 'DKI Jakarta' },
          { id: 2, province_name: 'Jawa Barat' },
          { id: 3, province_name: 'Jawa Tengah' },
          { id: 4, province_name: 'Jawa Timur' },
          { id: 5, province_name: 'Sumatera Utara' }
        ];
        
        res.json({
          success: true,
          data: provinces
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch provinces',
          error: error.message
        });
      }
    },
    getCommodities: async (req, res) => {
      try {
        // Fallback data komoditas
        const commodities = [
          { id: 1, name: 'Beras Premium', unit: 'kg', category: 'beras', source: 'national' },
          { id: 2, name: 'Beras Medium', unit: 'kg', category: 'beras', source: 'national' },
          { id: 3, name: 'Cabai Merah', unit: 'kg', category: 'sayuran', source: 'national' },
          { id: 4, name: 'Bawang Merah', unit: 'kg', category: 'bumbu', source: 'national' }
        ];
        
        res.json({
          success: true,
          data: commodities
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch commodities',
          error: error.message
        });
      }
    },
    downloadTemplate: (req, res) => {
      try {
        const templateData = [
          {
            commodity_type: 'existing',
            commodity_id: 1,
            commodity_name: '',
            commodity_unit: '',
            commodity_category: '',
            market_name: 'Pasar Minggu',
            market_type: 'traditional',
            market_location: 'Jakarta Selatan',
            province_name: 'DKI Jakarta',
            city_name: 'Jakarta Selatan',
            price: 15000,
            quality_grade: 'standard',
            date_recorded: '2025-01-20',
            time_recorded: '08:30:00',
            notes: 'Contoh menggunakan komoditas existing'
          },
          {
            commodity_type: 'new',
            commodity_id: '',
            commodity_name: 'Tempe Lokal Segar',
            commodity_unit: 'kg',
            commodity_category: 'lainnya',
            market_name: 'Pasar Kebayoran',
            market_type: 'traditional',
            market_location: 'Jakarta Selatan',
            province_name: 'DKI Jakarta',
            city_name: 'Jakarta Selatan',
            price: 12000,
            quality_grade: 'standard',
            date_recorded: '2025-01-20',
            time_recorded: '09:00:00',
            notes: 'Contoh membuat komoditas baru'
          }
        ];

        const headers = Object.keys(templateData[0]);
        const csvContent = [
          headers.join(','),
          ...templateData.map(row => headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          }).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=template-market-prices.csv');
        res.send(csvContent);
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Failed to download template',
          error: error.message
        });
      }
    }
  };
}

// Authentication middleware (fallback)
const authenticateToken = (req, res, next) => {
  // For now, just pass through
  // In production, implement proper auth
  req.user = { id: 1, username: 'test' };
  next();
};

// Routes
router.get('/', marketPriceController.getMarketPrices);
router.get('/provinces', marketPriceController.getProvinces);
router.get('/commodities', marketPriceController.getCommodities);
router.get('/template', marketPriceController.downloadTemplate);

// Protected routes
router.post('/', 
  authenticateToken, 
  marketPriceController.uploadImage, 
  marketPriceController.addMarketPrice
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Market Price Route Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error in market price routes',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;