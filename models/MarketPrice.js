const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MarketPrice = sequelize.define('MarketPrice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  commodity_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  source_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  market_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  market_location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'kg'
  },
  quality_grade: {
    type: DataTypes.ENUM('premium', 'standard', 'economy'),
    defaultValue: 'standard'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verified_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  evidence_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reported_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'market_prices'
});

module.exports = MarketPrice;