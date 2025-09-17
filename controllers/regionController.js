// controllers/regionController.js
const { Region } = require('../models');
const { Op } = require('sequelize');

const regionController = {
  getProvinces: async (req, res) => {
    try {
      const provinces = await Region.findAll({
        where: {
          level: 'province'
        },
        attributes: ['id', 'province_id', 'province_name'],
        group: ['province_id', 'province_name'],
        order: [['province_name', 'ASC']]
      });

      res.json({
        success: true,
        data: provinces
      });
    } catch (error) {
      console.error('Error fetching provinces:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch provinces',
        error: error.message
      });
    }
  },

  getCities: async (req, res) => {
    try {
      const { provinceId } = req.params;
      
      const cities = await Region.findAll({
        where: {
          province_id: provinceId,
          level: 'city'
        },
        attributes: ['id', 'city_id', 'city_name'],
        order: [['city_name', 'ASC']]
      });

      res.json({
        success: true,
        data: cities
      });
    } catch (error) {
      console.error('Error fetching cities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch cities',
        error: error.message
      });
    }
  },

  getAllRegions: async (req, res) => {
    try {
      const regions = await Region.findAll({
        order: [['level', 'ASC'], ['province_name', 'ASC'], ['city_name', 'ASC']]
      });

      res.json({
        success: true,
        data: regions
      });
    } catch (error) {
      console.error('Error fetching regions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch regions',
        error: error.message
      });
    }
  }
};

module.exports = regionController;