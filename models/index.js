const Commodity = require('./Commodity');
const Price = require('./Price');
const PriceOverride = require('./PriceOverride');
const Region = require('./Region');
const User = require('./User');
const AuditLog = require('./AuditLog');
const DataSource = require('./DataSource');
const MarketPrice = require('./MarketPrice');

// Define associations
Price.belongsTo(Commodity, { foreignKey: 'commodity_id' });
Commodity.hasMany(Price, { foreignKey: 'commodity_id' });

MarketPrice.belongsTo(Commodity, { foreignKey: 'commodity_id' });
MarketPrice.belongsTo(DataSource, { foreignKey: 'source_id' });
MarketPrice.belongsTo(User, { as: 'reporter', foreignKey: 'reported_by' });
MarketPrice.belongsTo(User, { as: 'verifier', foreignKey: 'verified_by' });

Commodity.hasMany(MarketPrice, { foreignKey: 'commodity_id' });

Price.belongsTo(Region, { foreignKey: 'region_id' });
Region.hasMany(Price, { foreignKey: 'region_id' });

PriceOverride.belongsTo(Price, { foreignKey: 'price_id' });
PriceOverride.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });
PriceOverride.belongsTo(User, { as: 'approver', foreignKey: 'approved_by' });

module.exports = {
  Commodity,
  Price,
  PriceOverride,
  Region,
  User,
  AuditLog,
  DataSource,
  MarketPrice
};