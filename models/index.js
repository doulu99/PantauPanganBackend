// models/index.js - Updated with CustomCommodity
const Commodity = require('./Commodity');
const Price = require('./Price');
const PriceOverride = require('./PriceOverride');
const Region = require('./Region');
const User = require('./User');
const AuditLog = require('./AuditLog');
const DataSource = require('./DataSource');
const MarketPrice = require('./MarketPrice');

// Import CustomCommodity dengan error handling
let CustomCommodity = null;
try {
  CustomCommodity = require('./CustomCommodity');
  console.log('✅ CustomCommodity model loaded');
} catch (error) {
  console.warn('⚠️ CustomCommodity model not found, skipping associations');
}

// Define associations
Price.belongsTo(Commodity, { foreignKey: 'commodity_id' });
Commodity.hasMany(Price, { foreignKey: 'commodity_id' });

MarketPrice.belongsTo(Commodity, { 
  foreignKey: 'commodity_id',
  constraints: false,
  scope: {
    commodity_source: 'national'
  }
});

// CustomCommodity associations (jika model ada)
if (CustomCommodity) {
  // MarketPrice associations with CustomCommodity
  MarketPrice.belongsTo(CustomCommodity, { 
    foreignKey: 'commodity_id',
    as: 'custom_commodity',
    constraints: false,
    scope: {
      commodity_source: 'custom'
    }
  });

  // CustomCommodity associations
  CustomCommodity.belongsTo(User, { 
    foreignKey: 'created_by', 
    as: 'creator' 
  });

  CustomCommodity.hasMany(MarketPrice, { 
    foreignKey: 'commodity_id',
    as: 'market_prices',
    constraints: false,
    scope: {
      commodity_source: 'custom'
    }
  });

  User.hasMany(CustomCommodity, { 
    foreignKey: 'created_by', 
    as: 'custom_commodities' 
  });
}

MarketPrice.belongsTo(DataSource, { foreignKey: 'source_id' });
MarketPrice.belongsTo(User, { as: 'reporter', foreignKey: 'reported_by' });
MarketPrice.belongsTo(User, { as: 'verifier', foreignKey: 'verified_by' });

Commodity.hasMany(MarketPrice, { 
  foreignKey: 'commodity_id',
  constraints: false,
  scope: {
    commodity_source: 'national'
  }
});

// Existing associations
Price.belongsTo(Region, { foreignKey: 'region_id' });
Region.hasMany(Price, { foreignKey: 'region_id' });

PriceOverride.belongsTo(Price, { foreignKey: 'price_id' });
PriceOverride.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });
PriceOverride.belongsTo(User, { as: 'approver', foreignKey: 'approved_by' });

// Export all models
const models = {
  Commodity,
  Price,
  PriceOverride,
  Region,
  User,
  AuditLog,
  DataSource,
  MarketPrice
};

// Add CustomCommodity only if it exists
if (CustomCommodity) {
  models.CustomCommodity = CustomCommodity;
}

module.exports = models;