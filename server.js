// server.js - Fixed version with safer database sync
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const morgan = require('morgan');

// Load environment variables
dotenv.config();

// Import routes
const priceRoutes = require('./routes/priceRoutes');
const overrideRoutes = require('./routes/overrideRoutes');
const authRoutes = require('./routes/authRoutes');
const regionRoutes = require('./routes/regionRoutes');
const marketPriceRoutes = require('./routes/marketPriceRoutes');
const customCommodityRoutes = require('./routes/customCommodities');

// Import services
const { syncPricesFromAPI } = require('./services/priceSync');

// Import database connection
const sequelize = require('./config/database');

// Import swagger
const { swaggerUi, specs } = require('./swagger');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use('/api/prices', priceRoutes);
app.use('/api/overrides', overrideRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/market-prices', marketPriceRoutes);
app.use('/api/commodities/custom', customCommodityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.1.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Food Price Monitor API',
    version: '1.1.0',
    endpoints: {
      health: '/api/health',
      prices: '/api/prices',
      auth: '/api/auth',
      regions: '/api/regions',
      overrides: '/api/overrides',
      marketPrices: '/api/market-prices',
      customCommodities: '/api/commodities/custom'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Schedule automatic sync every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('⏰ Running scheduled price sync...');
  try {
    await syncPricesFromAPI({
      levelHargaId: 3,
      includeProvinceMap: true,
      komoditasIds: [109, 27, 28]
    });
    console.log('✅ Scheduled sync completed successfully');
  } catch (error) {
    console.error('❌ Scheduled sync failed:', error);
  }
});

// Database connection and server start
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Safer sync - only create new tables, don't alter existing ones
    try {
      console.log('🔄 Syncing database models...');
      
      // First, sync without altering existing tables
      await sequelize.sync({ force: false, alter: false });
      console.log('✅ Database models synced (safe mode)');
      
      // If sync fails, try individual model sync for new models only
    } catch (syncError) {
      console.warn('⚠️ Standard sync failed, trying individual model sync:', syncError.message);
      
      // Import models individually and sync only new ones
      try {
        const { CustomCommodity } = require('./models');
        
        if (CustomCommodity) {
          console.log('🔄 Syncing CustomCommodity model...');
          await CustomCommodity.sync({ force: false });
          console.log('✅ CustomCommodity model synced');
        }
      } catch (modelError) {
        console.warn('⚠️ CustomCommodity sync failed (might already exist):', modelError.message);
      }
      
      console.log('✅ Database sync completed with warnings');
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`📚 API Documentation at http://localhost:${PORT}/api-docs`);
      console.log(`🔍 Test the API at http://localhost:${PORT}/api/health`);
      console.log(`🆕 Custom Commodities API at http://localhost:${PORT}/api/commodities/custom`);
    });
    
    // Initial data sync (non-blocking)
    console.log('🔄 Starting initial price sync in background...');
    
    syncPricesFromAPI({
      levelHargaId: 3,
      includeProvinceMap: false,
      komoditasIds: [109]
    })
    .then((result) => {
      console.log('✅ Initial sync completed:', result.stats);
      
      if (process.env.NODE_ENV === 'production') {
        return syncPricesFromAPI({
          levelHargaId: 3,
          includeProvinceMap: true,
          komoditasIds: [109, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37]
        });
      }
    })
    .then((result) => {
      if (result) {
        console.log('✅ Comprehensive sync completed:', result.stats);
      }
    })
    .catch(err => console.error('⚠️ Sync failed (non-critical):', err.message));
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    // If database connection fails, still start server for debugging
    if (error.name === 'SequelizeDatabaseError') {
      console.warn('⚠️ Starting server without database sync for debugging...');
      
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} (DATABASE ISSUES)`);
        console.log(`🔍 Check database connection and try again`);
        console.log(`📊 Limited API available at http://localhost:${PORT}/api/health`);
      });
    } else {
      process.exit(1);
    }
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing server gracefully...');
  await sequelize.close();
  process.exit(0);
});