// server.js - FIXED VERSION with better error handling
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');

// Load environment variables first
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Global error handler middleware
const globalErrorHandler = (err, req, res, next) => {
  console.error('🚨 Global Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    body: req.body
  });

  // Determine error type and status
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'Database operation failed';
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (err.name === 'SequelizeConnectionError') {
    statusCode = 503;
    message = 'Database connection failed';
  } else if (err.statusCode || err.status) {
    statusCode = err.statusCode || err.status;
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && {
      error: err.message,
      stack: err.stack
    })
  });
};

// Health check endpoint (always available)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.2.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Food Price Monitor API',
    version: '1.2.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      prices: '/api/prices',
      auth: '/api/auth',
      regions: '/api/regions',
      overrides: '/api/overrides',
      marketPrices: '/api/market-prices',
      customCommodities: '/api/commodities/custom',
      docs: '/api-docs'
    }
  });
});

// Load routes with error handling
const loadRoutes = () => {
  console.log('🔗 Loading API routes...');
  
  try {
    const priceRoutes = require('./routes/priceRoutes');
    app.use('/api/prices', priceRoutes);
    console.log('✅ Price routes loaded');
  } catch (error) {
    console.warn('⚠️ Price routes failed to load:', error.message);
  }

  try {
    const overrideRoutes = require('./routes/overrideRoutes');
    app.use('/api/overrides', overrideRoutes);
    console.log('✅ Override routes loaded');
  } catch (error) {
    console.warn('⚠️ Override routes failed to load:', error.message);
  }

  try {
    const authRoutes = require('./routes/authRoutes');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
  } catch (error) {
    console.warn('⚠️ Auth routes failed to load:', error.message);
  }

  try {
    const regionRoutes = require('./routes/regionRoutes');
    app.use('/api/regions', regionRoutes);
    console.log('✅ Region routes loaded');
  } catch (error) {
    console.warn('⚠️ Region routes failed to load:', error.message);
  }

  try {
    const marketPriceRoutes = require('./routes/marketPriceRoutes');
    app.use('/api/market-prices', marketPriceRoutes);
    console.log('✅ Market price routes loaded');
  } catch (error) {
    console.warn('⚠️ Market price routes failed to load:', error.message);
    // Add fallback route for market prices
    app.use('/api/market-prices', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'Market price service temporarily unavailable',
        error: 'Routes not loaded properly'
      });
    });
  }

  try {
    const customCommodityRoutes = require('./routes/customCommodities');
    app.use('/api/commodities/custom', customCommodityRoutes);
    console.log('✅ Custom commodity routes loaded');
  } catch (error) {
    console.warn('⚠️ Custom commodity routes failed to load:', error.message);
  }

  // Load swagger documentation
  try {
    const { swaggerUi, specs } = require('./swagger');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }'
    }));
    console.log('✅ API documentation loaded at /api-docs');
  } catch (error) {
    console.warn('⚠️ Swagger documentation failed to load:', error.message);
  }
};

// Load routes
loadRoutes();

// Catch-all route for undefined endpoints
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/prices',
      'GET /api/market-prices',
      'GET /api/regions',
      'GET /api-docs'
    ]
  });
});

// Apply global error handler
app.use(globalErrorHandler);

// Database initialization and server startup
const startServer = async () => {
  console.log('🚀 Starting Food Price Monitor API...');
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  try {
    // Test database connection
    console.log('🔍 Testing database connection...');
    const { sequelize, testConnection, syncDatabase, checkModelAvailability } = require('./models');
    
    const connectionTest = await testConnection();
    if (!connectionTest) {
      console.warn('⚠️ Database connection failed, starting server in limited mode...');
    } else {
      console.log('✅ Database connected successfully');
      
      // Check model availability
      const modelStatus = checkModelAvailability();
      console.log('📊 Model status check completed');
      
      // Attempt database sync
      try {
        console.log('🔄 Attempting database sync...');
        await syncDatabase({ force: false, alter: false });
        console.log('✅ Database models synchronized');
      } catch (syncError) {
        console.warn('⚠️ Database sync failed, continuing with existing schema:', syncError.message);
        
        // Try individual critical table sync
        try {
          const { MarketPrice, Commodity, User } = require('./models');
          
          if (MarketPrice) {
            await MarketPrice.sync({ force: false });
            console.log('✅ MarketPrice table ready');
          }
          
          if (Commodity) {
            await Commodity.sync({ force: false });
            console.log('✅ Commodity table ready');
          }
          
          if (User) {
            await User.sync({ force: false });
            console.log('✅ User table ready');
          }
          
        } catch (individualSyncError) {
          console.warn('⚠️ Individual table sync also failed:', individualSyncError.message);
        }
      }
    }
    
    // Start the server
    const server = app.listen(PORT, () => {
      console.log('🎉 Server started successfully!');
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`📚 API Documentation at http://localhost:${PORT}/api-docs`);
      console.log(`🔍 Health check at http://localhost:${PORT}/api/health`);
      console.log(`💰 Market Prices API at http://localhost:${PORT}/api/market-prices`);
      console.log(`🏪 Custom Commodities API at http://localhost:${PORT}/api/commodities/custom`);
      
      // Test critical endpoints
      setTimeout(() => {
        console.log('🧪 Running endpoint tests...');
        testEndpoints();
      }, 2000);
    });

    // Handle server shutdown gracefully
    const gracefulShutdown = (signal) => {
      console.log(`\n📴 Received ${signal}. Shutting down gracefully...`);
      
      server.close(async () => {
        console.log('🔌 HTTP server closed');
        
        try {
          if (sequelize) {
            await sequelize.close();
            console.log('🔌 Database connection closed');
          }
        } catch (error) {
          console.error('❌ Error closing database:', error.message);
        }
        
        console.log('👋 Server shutdown complete');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.error('⏰ Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Start background services
    startBackgroundServices();
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    // Start server in emergency mode
    console.warn('⚠️ Starting server in emergency mode without database...');
    
    app.listen(PORT, () => {
      console.log('🚨 Emergency server started!');
      console.log(`🌐 Server running on port ${PORT} (LIMITED MODE)`);
      console.log(`🔍 Health check available at http://localhost:${PORT}/api/health`);
      console.log('📋 Database features disabled');
    });
  }
};

// Background services
const startBackgroundServices = () => {
  console.log('🔄 Starting background services...');
  
  // Schedule price synchronization
  try {
    const cron = require('node-cron');
    const { syncPricesFromAPI } = require('./services/priceSync');
    
    // Schedule every 6 hours
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
        console.error('❌ Scheduled sync failed:', error.message);
      }
    });
    
    console.log('✅ Price sync scheduler started (every 6 hours)');
    
    // Initial sync (non-blocking)
    setTimeout(async () => {
      console.log('🔄 Starting initial price sync in background...');
      
      try {
        const result = await syncPricesFromAPI({
          levelHargaId: 3,
          includeProvinceMap: false,
          komoditasIds: [109]
        });
        console.log('✅ Initial sync completed:', result.stats);
        
        // Extended sync in production
        if (process.env.NODE_ENV === 'production') {
          try {
            const extendedResult = await syncPricesFromAPI({
              levelHargaId: 3,
              includeProvinceMap: true,
              komoditasIds: [109, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37]
            });
            console.log('✅ Extended sync completed:', extendedResult.stats);
          } catch (extendedError) {
            console.warn('⚠️ Extended sync failed (non-critical):', extendedError.message);
          }
        }
      } catch (error) {
        console.warn('⚠️ Initial sync failed (non-critical):', error.message);
      }
    }, 5000); // Wait 5 seconds after server start
    
  } catch (error) {
    console.warn('⚠️ Background services failed to start:', error.message);
  }
};

// Test critical endpoints
const testEndpoints = async () => {
  const axios = require('axios').default;
  const baseURL = `http://localhost:${PORT}`;
  
  const endpoints = [
    { name: 'Health Check', url: '/api/health' },
    { name: 'Market Prices', url: '/api/market-prices?limit=1' },
    { name: 'Market Stats', url: '/api/market-prices/stats' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${baseURL}${endpoint.url}`, { timeout: 5000 });
      if (response.status === 200) {
        console.log(`✅ ${endpoint.name}: OK`);
      } else {
        console.warn(`⚠️ ${endpoint.name}: Status ${response.status}`);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`❌ ${endpoint.name}: Connection refused`);
      } else if (error.response) {
        console.warn(`⚠️ ${endpoint.name}: HTTP ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
      } else {
        console.warn(`⚠️ ${endpoint.name}: ${error.message}`);
      }
    }
  }
  
  console.log('🧪 Endpoint testing completed');
};

// Export app for testing
module.exports = app;

// Start server if this file is run directly
if (require.main === module) {
  startServer().catch(error => {
    console.error('💥 Fatal error during server startup:', error);
    process.exit(1);
  });
}