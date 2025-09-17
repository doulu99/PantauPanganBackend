// models/Commodity.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Commodity = sequelize.define('Commodity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  external_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID from Badan Pangan API'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Rp/kg'
  },
  category: {
    type: DataTypes.ENUM('beras', 'sayuran', 'daging', 'bumbu', 'lainnya'),
    allowNull: false,
    defaultValue: 'lainnya'
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  tableName: 'commodities'
});

module.exports = Commodity;