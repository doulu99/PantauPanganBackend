// models/Price.js - Fixed version
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Price = sequelize.define('Price', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  commodity_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  region_id: {
    type: DataTypes.INTEGER,
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
  source: {
    type: DataTypes.ENUM('api', 'manual'),
    defaultValue: 'api'
  },
  is_override: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  level: {
    type: DataTypes.ENUM('produsen', 'grosir', 'eceran', 'konsumen'), // Added 'konsumen'
    defaultValue: 'konsumen' // Changed default to konsumen
  }
}, {
  timestamps: true,
  tableName: 'prices',
  indexes: [
    {
      unique: false,
      fields: ['commodity_id', 'date', 'region_id']
    }
  ]
});

module.exports = Price;