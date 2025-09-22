// controllers/debugController.js - Untuk testing dan debugging
const { Commodity, Price, MarketPrice, sequelize } = require('../models');

const debugController = {
  // Test koneksi database
  testDatabase: async (req, res) => {
    try {
      await sequelize.authenticate();
      
      // Cek apakah tabel sudah ada
      const tables = await sequelize.query("SHOW TABLES", { 
        type: sequelize.QueryTypes.SELECT 
      });
      
      res.json({
        success: true,
        message: "Database connected successfully",
        tables: tables
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Database connection failed",
        error: error.message
      });
    }
  },

  // Cek jumlah data di setiap tabel
  checkData: async (req, res) => {
    try {
      const results = {};
      
      // Count commodities
      if (Commodity) {
        results.commodities = await Commodity.count();
      }
      
      // Count prices
      if (Price) {
        results.prices = await Price.count();
      }
      
      // Count market prices
      if (MarketPrice) {
        results.market_prices = await MarketPrice.count();
      }
      
      res.json({
        success: true,
        message: "Data count retrieved",
        data: results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to check data",
        error: error.message
      });
    }
  },

  // Tambah sample data untuk testing
  addSampleData: async (req, res) => {
    try {
      const sampleCommodities = [
        { name: 'Beras Premium', unit: 'Rp/kg', category: 'beras' },
        { name: 'Cabai Merah', unit: 'Rp/kg', category: 'bumbu' },
        { name: 'Daging Sapi', unit: 'Rp/kg', category: 'daging' }
      ];

      const createdCommodities = [];
      for (const commodity of sampleCommodities) {
        const [created, isNew] = await Commodity.findOrCreate({
          where: { name: commodity.name },
          defaults: commodity
        });
        createdCommodities.push(created);
      }

      // Tambah sample prices
      const today = new Date().toISOString().split('T')[0];
      const samplePrices = [
        { commodity_id: createdCommodities[0].id, price: 12000, date: today },
        { commodity_id: createdCommodities[1].id, price: 35000, date: today },
        { commodity_id: createdCommodities[2].id, price: 130000, date: today }
      ];

      const createdPrices = [];
      for (const price of samplePrices) {
        const [created, isNew] = await Price.findOrCreate({
          where: { 
            commodity_id: price.commodity_id, 
            date: price.date 
          },
          defaults: price
        });
        createdPrices.push(created);
      }

      // Tambah sample market prices
      const sampleMarketPrices = [
        { 
          product_name: 'Beras Premium', 
          price: 12500, 
          market_type: 'Pasar Tradisional',
          grade: 'Premium'
        },
        { 
          product_name: 'Cabai Merah Keriting', 
          price: 38000, 
          market_type: 'Pasar Modern',
          grade: 'Standar'
        }
      ];

      const createdMarketPrices = [];
      for (const marketPrice of sampleMarketPrices) {
        const created = await MarketPrice.create(marketPrice);
        createdMarketPrices.push(created);
      }

      res.json({
        success: true,
        message: "Sample data created successfully",
        data: {
          commodities: createdCommodities.length,
          prices: createdPrices.length,
          market_prices: createdMarketPrices.length
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to create sample data",
        error: error.message
      });
    }
  },

  // Test BPN API langsung
  testBPNApi: async (req, res) => {
    try {
      const axios = require('axios');
      
      const bpnUrl = 'https://api-panelhargav2.badanpangan.go.id/api/front/harga-pangan-informasi?province_id=&city_id=&level_harga_id=3';
      
      console.log('Testing BPN API:', bpnUrl);
      
      const response = await axios.get(bpnUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      res.json({
        success: true,
        message: "BPN API test successful",
        status: response.status,
        data_count: response.data?.data?.length || 0,
        sample_data: response.data?.data?.slice(0, 3) || []
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "BPN API test failed",
        error: error.message,
        details: error.response?.data || null
      });
    }
  },

  // Force sync BPN data
  forceBPNSync: async (req, res) => {
    try {
      const bpnApiService = require('../services/bpnApiService');
      
      console.log('Starting forced BPN sync...');
      
      const result = await bpnApiService.fullSync({
        provinceId: '',
        cityId: '',
        levelHargaId: 3
      });

      res.json({
        success: result.success,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Force sync failed",
        error: error.message
      });
    }
  }
};

module.exports = debugController;