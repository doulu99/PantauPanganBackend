// models/MarketPrice.js - Updated version
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
  commodity_source: {
    type: DataTypes.ENUM(['national', 'custom']),
    allowNull: false,
    defaultValue: 'national'
  },
  source_id: {
    type: DataTypes.INTEGER,
    allowNull: true // Make nullable for custom commodities
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
  tableName: 'market_prices',
  indexes: [
    {
      fields: ['commodity_id', 'date']
    },
    {
      fields: ['commodity_source']
    },
    {
      fields: ['market_name']
    }
  ]
});

module.exports = MarketPrice;