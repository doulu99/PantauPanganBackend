const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DataSource = sequelize.define('DataSource', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('api', 'market', 'survey', 'crowdsource'),
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Higher priority sources are preferred'
  }
}, {
  timestamps: true,
  tableName: 'data_sources'
});

module.exports = DataSource;