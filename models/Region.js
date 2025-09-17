// models/Region.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Region = sequelize.define('Region', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  province_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  province_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  city_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  city_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  level: {
    type: DataTypes.ENUM('national', 'province', 'city'),
    defaultValue: 'national'
  }
}, {
  timestamps: true,
  tableName: 'regions'
});

module.exports = Region;