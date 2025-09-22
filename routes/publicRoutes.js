// routes/publicRoutes.js - Updated to use BPN service
const express = require("express");
const router = express.Router();
const { Region } = require("../models");
const MarketPrice = require("../models/MarketPrice");
const bpnController = require("../controllers/bpnController");

// BPN API routes (public access)
router.get("/bpn/prices/current", bpnController.getCurrentPrices);
router.get("/bpn/commodities", bpnController.getCommodities);
router.get("/bpn/sync/status", bpnController.getSyncStatus);

// Legacy routes for backward compatibility
router.get("/prices/current", bpnController.getCurrentPrices);

// Regions route (simplified)
router.get("/regions/provinces", async (req, res) => {
  try {
    const provinces = await Region.sequelize.query(`
      SELECT DISTINCT province_id, province_name 
      FROM regions 
      WHERE level = 'province' 
      AND province_id IS NOT NULL
      ORDER BY province_name ASC
    `, { 
      type: Region.sequelize.QueryTypes.SELECT 
    });

    res.json({
      success: true,
      data: provinces
    });
  } catch (error) {
    console.error("Error fetching provinces:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch provinces",
      error: error.message
    });
  }
});

// Market prices routes (existing)
router.get("/market-prices", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      market_type, 
      province_id 
    } = req.query;

    const whereClause = {};
    
    if (search) {
      whereClause.product_name = {
        [require("sequelize").Op.like]: `%${search}%`
      };
    }

    if (market_type) {
      whereClause.market_type = market_type;
    }

    if (province_id) {
      whereClause.province_id = province_id;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await MarketPrice.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      message: "Data berhasil diambil",
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching market prices:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch market prices",
      error: error.message
    });
  }
});

// Manual sync endpoint for testing
router.post("/bpn/sync", async (req, res) => {
  try {
    const bpnApiService = require('../services/bpnApiService');
    const result = await bpnApiService.fullSync();
    
    res.json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Sync failed",
      error: error.message
    });
  }
});

module.exports = router;