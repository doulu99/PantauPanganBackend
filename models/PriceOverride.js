// models/PriceOverride.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PriceOverride = sequelize.define('PriceOverride', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  price_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  original_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  override_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  evidence_url: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL to uploaded evidence photo'
  },
  source_info: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Information about data source'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true,
  tableName: 'price_overrides'
});

module.exports = PriceOverride;