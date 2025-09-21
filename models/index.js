// models/index.js - FIXED VERSION with Proper Commodity Associations
const sequelize = require('../config/database');

// Initialize models with error handling
let models = {};

// Load base models
try {
  models.Commodity = require('./Commodity');
  console.log('✅ Commodity model loaded');
} catch (error) {
  console.warn('⚠️ Commodity model failed to load:', error.message);
}

try {
  models.Price = require('./Price');
  console.log('✅ Price model loaded');
} catch (error) {
  console.warn('⚠️ Price model failed to load:', error.message);
}

try {
  models.PriceOverride = require('./PriceOverride');
  console.log('✅ PriceOverride model loaded');
} catch (error) {
  console.warn('⚠️ PriceOverride model failed to load:', error.message);
}

try {
  models.Region = require('./Region');
  console.log('✅ Region model loaded');
} catch (error) {
  console.warn('⚠️ Region model failed to load:', error.message);
}

try {
  models.User = require('./User');
  console.log('✅ User model loaded');
} catch (error) {
  console.warn('⚠️ User model failed to load:', error.message);
}

try {
  models.AuditLog = require('./AuditLog');
  console.log('✅ AuditLog model loaded');
} catch (error) {
  console.warn('⚠️ AuditLog model failed to load:', error.message);
}

try {
  models.DataSource = require('./DataSource');
  console.log('✅ DataSource model loaded');
} catch (error) {
  console.warn('⚠️ DataSource model failed to load:', error.message);
}

try {
  models.MarketPrice = require('./MarketPrice');
  console.log('✅ MarketPrice model loaded');
} catch (error) {
  console.warn('⚠️ MarketPrice model failed to load:', error.message);
}

// Load CustomCommodity with specific error handling
try {
  models.CustomCommodity = require('./CustomCommodity');
  console.log('✅ CustomCommodity model loaded');
} catch (error) {
  console.warn('⚠️ CustomCommodity model not found, will skip custom commodity features:', error.message);
  models.CustomCommodity = null;
}

// Define associations with proper error handling
const setupAssociations = () => {
  console.log('🔗 Setting up model associations...');
  
  try {
    // Basic Price-Commodity associations
    if (models.Price && models.Commodity) {
      models.Price.belongsTo(models.Commodity, { foreignKey: 'commodity_id' });
      models.Commodity.hasMany(models.Price, { foreignKey: 'commodity_id' });
      console.log('✅ Price-Commodity associations set');
    }

    // ========== FIXED MARKETPRICE ASSOCIATIONS ==========
    if (models.MarketPrice) {
      
      // IMPORTANT: Don't use automatic associations for MarketPrice-Commodity
      // We'll manually fetch commodity data in the controller based on commodity_source
      
      console.log('⚠️ MarketPrice associations configured for manual fetching');
      console.log('   - commodity_source="custom" → fetch from custom_commodities table');
      console.log('   - commodity_source="national" → fetch from commodities table');

      // Only set up non-commodity associations
      if (models.DataSource) {
        models.MarketPrice.belongsTo(models.DataSource, { 
          foreignKey: 'source_id',
          constraints: false
        });
        console.log('✅ MarketPrice-DataSource associations set');
      }

      if (models.User) {
        models.MarketPrice.belongsTo(models.User, { 
          as: 'reporter', 
          foreignKey: 'reported_by',
          constraints: false
        });
        models.MarketPrice.belongsTo(models.User, { 
          as: 'verifier', 
          foreignKey: 'verified_by',
          constraints: false
        });
        console.log('✅ MarketPrice-User associations set');
      }
    }

    // CustomCommodity to User association
    if (models.CustomCommodity && models.User) {
      models.CustomCommodity.belongsTo(models.User, { 
        foreignKey: 'created_by', 
        as: 'creator',
        constraints: false
      });

      models.User.hasMany(models.CustomCommodity, { 
        foreignKey: 'created_by', 
        as: 'custom_commodities',
        constraints: false
      });
      console.log('✅ CustomCommodity-User associations set');
    }

    // Region associations
    if (models.Price && models.Region) {
      models.Price.belongsTo(models.Region, { foreignKey: 'region_id' });
      models.Region.hasMany(models.Price, { foreignKey: 'region_id' });
      console.log('✅ Price-Region associations set');
    }

    // PriceOverride associations
    if (models.PriceOverride) {
      if (models.Price) {
        models.PriceOverride.belongsTo(models.Price, { foreignKey: 'price_id' });
      }
      if (models.User) {
        models.PriceOverride.belongsTo(models.User, { as: 'creator', foreignKey: 'created_by' });
        models.PriceOverride.belongsTo(models.User, { as: 'approver', foreignKey: 'approved_by' });
      }
      console.log('✅ PriceOverride associations set');
    }

    console.log('✅ All model associations configured successfully');
    console.log('📝 Note: MarketPrice commodity data will be fetched manually in controller');
  } catch (error) {
    console.error('❌ Error setting up associations:', error.message);
  }
};

// Setup associations
setupAssociations();

// Add helper functions to models
const addHelperMethods = () => {
  // Add method to get commodity info for MarketPrice
  if (models.MarketPrice) {
    models.MarketPrice.prototype.getCommodityInfo = async function() {
      try {
        if (this.commodity_source === 'custom' && models.CustomCommodity) {
          const commodity = await models.CustomCommodity.findByPk(this.commodity_id, {
            attributes: ['id', 'name', 'unit', 'category', 'description']
          });
          return commodity ? { ...commodity.toJSON(), source: 'custom' } : null;
        } else if (models.Commodity) {
          const commodity = await models.Commodity.findByPk(this.commodity_id, {
            attributes: ['id', 'name', 'unit', 'category']
          });
          return commodity ? { ...commodity.toJSON(), source: 'national' } : null;
        }
        return null;
      } catch (error) {
        console.error('Error fetching commodity info:', error);
        return null;
      }
    };
  }

  // Add sync method for safer database operations
  models.syncDatabase = async (options = {}) => {
    try {
      console.log('🔄 Starting database sync...');
      
      const syncOptions = {
        force: false,
        alter: false,
        ...options
      };
      
      await sequelize.sync(syncOptions);
      console.log('✅ Database sync completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Database sync failed:', error.message);
      
      // Try individual model sync for critical models
      const criticalModels = ['User', 'Commodity', 'CustomCommodity', 'MarketPrice'];
      let successCount = 0;
      
      for (const modelName of criticalModels) {
        if (models[modelName]) {
          try {
            await models[modelName].sync({ force: false });
            console.log(`✅ ${modelName} synced individually`);
            successCount++;
          } catch (modelError) {
            console.warn(`⚠️ ${modelName} sync failed:`, modelError.message);
          }
        }
      }
      
      if (successCount > 0) {
        console.log(`✅ Partial sync completed: ${successCount}/${criticalModels.length} models`);
        return true;
      }
      
      throw error;
    }
  };

  // Add connection test method
  models.testConnection = async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      return false;
    }
  };

  // Add model availability check
  models.checkModelAvailability = () => {
    const status = {};
    const modelNames = ['Commodity', 'CustomCommodity', 'Price', 'MarketPrice', 'User', 'DataSource'];
    
    modelNames.forEach(name => {
      status[name] = {
        available: !!models[name],
        tableName: models[name]?.tableName || 'N/A'
      };
    });
    
    console.log('📊 Model availability status:', status);
    return status;
  };

  // Add debug method for MarketPrice commodity fetching
  models.debugMarketPriceCommodity = async (marketPriceId) => {
    if (!models.MarketPrice) {
      console.error('❌ MarketPrice model not available');
      return null;
    }

    try {
      const marketPrice = await models.MarketPrice.findByPk(marketPriceId);
      if (!marketPrice) {
        console.error(`❌ MarketPrice with ID ${marketPriceId} not found`);
        return null;
      }

      console.log(`🔍 Debugging MarketPrice ID ${marketPriceId}:`);
      console.log(`   - commodity_id: ${marketPrice.commodity_id}`);
      console.log(`   - commodity_source: ${marketPrice.commodity_source}`);

      let commodity = null;
      if (marketPrice.commodity_source === 'custom') {
        if (models.CustomCommodity) {
          commodity = await models.CustomCommodity.findByPk(marketPrice.commodity_id);
          console.log(`   - Custom commodity found: ${commodity ? commodity.name : 'NOT FOUND'}`);
        } else {
          console.log('   - CustomCommodity model not available');
        }
      } else {
        if (models.Commodity) {
          commodity = await models.Commodity.findByPk(marketPrice.commodity_id);
          console.log(`   - National commodity found: ${commodity ? commodity.name : 'NOT FOUND'}`);
        } else {
          console.log('   - Commodity model not available');
        }
      }

      return {
        marketPrice: marketPrice.toJSON(),
        commodity: commodity ? commodity.toJSON() : null
      };
    } catch (error) {
      console.error(`❌ Error debugging MarketPrice ${marketPriceId}:`, error.message);
      return null;
    }
  };
};

// Add helper methods
addHelperMethods();

// Export sequelize instance and models
module.exports = {
  sequelize,
  ...models
};