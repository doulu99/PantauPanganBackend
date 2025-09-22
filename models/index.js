// models/index.js
const sequelize = require('../config/database');

// Load models
const Commodity = require('./Commodity');
const Price = require('./Price');
const PriceOverride = require('./PriceOverride');
const Region = require('./Region');
const User = require('./User');
const AuditLog = require('./AuditLog');
const MarketPrice = require('./MarketPrice');

// 🔗 Setup associations
Commodity.hasMany(Price, { foreignKey: 'commodity_id' });
Price.belongsTo(Commodity, { foreignKey: 'commodity_id' });

Region.hasMany(Price, { foreignKey: 'region_id' });
Price.belongsTo(Region, { foreignKey: 'region_id' });

// ✅ MarketPrice → Region
MarketPrice.belongsTo(Region, {
  foreignKey: "province_id",
  targetKey: "province_id",
  as: "province"
});

// Export
module.exports = {
  sequelize,
  Commodity,
  Price,
  PriceOverride,
  Region,
  User,
  AuditLog,
  MarketPrice,
};
