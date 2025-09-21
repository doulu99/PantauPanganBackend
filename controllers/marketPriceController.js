// controllers/marketPriceController.js - Enhanced version with dynamic commodity
const { MarketPrice, Commodity, CustomCommodity, Region, User } = require('../models');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/market-images/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'market-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

/**
 * Add new market price with dynamic commodity support
 */
const addMarketPrice = async (req, res) => {
  try {
    const {
      commodity_type = 'existing',
      commodity_id,
      commodity_name,
      commodity_unit,
      commodity_category,
      market_name,
      market_type = 'traditional',
      market_location,
      province_name,
      city_name,
      price,
      quality_grade = 'standard',
      date_recorded,
      time_recorded,
      notes,
      latitude,
      longitude
    } = req.body;

    // Validate required fields
    if (!market_name || !price || !date_recorded) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: market_name, price, date_recorded'
      });
    }

    let finalCommodityId;
    let finalCommodityUnit;
    let commoditySource = 'national';

    // Handle commodity logic
    if (commodity_type === 'new') {
      // Create new custom commodity
      if (!commodity_name || !commodity_unit || !commodity_category) {
        return res.status(400).json({
          success: false,
          message: 'For new commodity: commodity_name, commodity_unit, and commodity_category are required'
        });
      }

      // Check if custom commodity already exists
      const existingCustomCommodity = await CustomCommodity.findOne({
        where: {
          name: commodity_name,
          unit: commodity_unit,
          category: commodity_category
        }
      });

      if (existingCustomCommodity) {
        finalCommodityId = existingCustomCommodity.id;
        finalCommodityUnit = existingCustomCommodity.unit;
        commoditySource = 'custom';
      } else {
        // Create new custom commodity
        const newCommodity = await CustomCommodity.create({
          name: commodity_name,
          unit: commodity_unit,
          category: commodity_category,
          created_by: req.user?.id || null,
          is_active: true
        });

        finalCommodityId = newCommodity.id;
        finalCommodityUnit = newCommodity.unit;
        commoditySource = 'custom';
      }

    } else {
      // Use existing commodity
      if (!commodity_id) {
        return res.status(400).json({
          success: false,
          message: 'commodity_id is required for existing commodity'
        });
      }

      // Try to find in national commodities first
      let commodity = await Commodity.findByPk(commodity_id);
      if (commodity) {
        finalCommodityId = commodity.id;
        finalCommodityUnit = commodity.unit;
        commoditySource = 'national';
      } else {
        // Try custom commodities
        commodity = await CustomCommodity.findByPk(commodity_id);
        if (commodity) {
          finalCommodityId = commodity.id;
          finalCommodityUnit = commodity.unit;
          commoditySource = 'custom';
        } else {
          return res.status(404).json({
            success: false,
            message: 'Commodity not found'
          });
        }
      }
    }

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/market-images/${req.file.filename}`;
    }

    // Create market price record
    const marketPrice = await MarketPrice.create({
      commodity_id: finalCommodityId,
      commodity_source: commoditySource,
      commodity_name: commodity_type === 'new' ? commodity_name : null, // Store name for new commodities
      market_name,
      market_type,
      market_location,
      province_name,
      city_name,
      price: parseFloat(price),
      unit: finalCommodityUnit,
      quality_grade,
      date_recorded,
      time_recorded,
      image_url: imageUrl,
      notes,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      source: 'manual',
      reported_by: req.user?.id || null
    });

    // Fetch complete record with commodity info
    const completeRecord = await MarketPrice.findByPk(marketPrice.id);
    const recordData = completeRecord.toJSON();
    
    // Add commodity info
    if (commoditySource === 'custom') {
      const customCommodity = await CustomCommodity.findByPk(finalCommodityId);
      recordData.commodity = customCommodity ? customCommodity.toJSON() : null;
    } else {
      const nationalCommodity = await Commodity.findByPk(finalCommodityId);
      recordData.commodity = nationalCommodity ? nationalCommodity.toJSON() : null;
    }

    recordData.reporter = req.user ? {
      id: req.user.id,
      full_name: req.user.full_name,
      username: req.user.username
    } : null;

    res.status(201).json({
      success: true,
      message: 'Market price added successfully',
      data: recordData
    });

  } catch (error) {
    console.error('Error adding market price:', error);
    
    // Clean up uploaded image if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to add market price',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get market prices with enhanced search
 */
const getMarketPrices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      commodity_name,
      market_name,
      market_type,
      province_name,
      city_name,
      quality_grade,
      verification_status,
      source,
      date_from,
      date_to,
      search,
      sort_by = 'date_recorded',
      sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = { is_active: true };
    
    // Build filters
    if (market_type) whereClause.market_type = market_type;
    if (quality_grade) whereClause.quality_grade = quality_grade;
    if (verification_status) whereClause.verification_status = verification_status;
    if (source) whereClause.source = source;
    
    // Text search filters
    if (market_name) whereClause.market_name = { [Op.like]: `%${market_name}%` };
    if (province_name) whereClause.province_name = { [Op.like]: `%${province_name}%` };
    if (city_name) whereClause.city_name = { [Op.like]: `%${city_name}%` };
    
    // Commodity name search (could be in commodity_name field or related table)
    if (commodity_name) {
      whereClause[Op.or] = [
        { commodity_name: { [Op.like]: `%${commodity_name}%` } },
        // We'll also search in related commodity tables via include
      ];
    }
    
    // Date range filter
    if (date_from || date_to) {
      whereClause.date_recorded = {};
      if (date_from) whereClause.date_recorded[Op.gte] = date_from;
      if (date_to) whereClause.date_recorded[Op.lte] = date_to;
    }
    
    // Global search
    if (search) {
      whereClause[Op.or] = [
        { market_name: { [Op.like]: `%${search}%` } },
        { market_location: { [Op.like]: `%${search}%` } },
        { province_name: { [Op.like]: `%${search}%` } },
        { city_name: { [Op.like]: `%${search}%` } },
        { commodity_name: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await MarketPrice.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sort_by, sort_order.toUpperCase()]],
      attributes: {
        exclude: ['is_active']
      }
    });

    // Enhance data with commodity and user info
    const enhancedRows = await Promise.all(rows.map(async (price) => {
      const priceData = price.toJSON();
      
      // Get commodity info based on source
      if (price.commodity_source === 'custom') {
        const customCommodity = await CustomCommodity.findByPk(price.commodity_id, {
          attributes: ['id', 'name', 'unit', 'category', 'description']
        });
        priceData.commodity = customCommodity ? { 
          ...customCommodity.toJSON(), 
          source: 'custom' 
        } : null;
      } else {
        const nationalCommodity = await Commodity.findByPk(price.commodity_id, {
          attributes: ['id', 'name', 'unit', 'category']
        });
        priceData.commodity = nationalCommodity ? { 
          ...nationalCommodity.toJSON(), 
          source: 'national' 
        } : null;
      }
      
      // Use stored commodity_name if available (for new commodities)
      if (price.commodity_name && !priceData.commodity) {
        priceData.commodity = {
          name: price.commodity_name,
          unit: price.unit,
          source: 'custom'
        };
      }
      
      // Get reporter info
      if (price.reported_by) {
        try {
          const reporter = await User.findByPk(price.reported_by, {
            attributes: ['id', 'full_name', 'username']
          });
          priceData.reporter = reporter ? reporter.toJSON() : null;
        } catch (err) {
          priceData.reporter = null;
        }
      }
      
      return priceData;
    }));

    res.json({
      success: true,
      data: {
        prices: enhancedRows,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / limit),
          total_records: count,
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching market prices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market prices',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get commodities (both national and custom) for dropdown
 */
const getCommodities = async (req, res) => {
  try {
    const { source = 'all', search = '' } = req.query;
    const commodities = [];

    // Get national commodities
    if (source === 'all' || source === 'national') {
      try {
        const whereClause = { is_active: true };
        if (search) {
          whereClause.name = { [Op.like]: `%${search}%` };
        }

        const nationalCommodities = await Commodity.findAll({
          where: whereClause,
          attributes: ['id', 'name', 'unit', 'category'],
          order: [['name', 'ASC']],
          limit: 50
        });
        
        nationalCommodities.forEach(commodity => {
          commodities.push({
            ...commodity.toJSON(),
            source: 'national'
          });
        });
      } catch (error) {
        console.warn('Error fetching national commodities:', error.message);
      }
    }

    // Get custom commodities
    if (source === 'all' || source === 'custom') {
      try {
        const whereClause = { is_active: true };
        if (search) {
          whereClause.name = { [Op.like]: `%${search}%` };
        }

        const customCommodities = await CustomCommodity.findAll({
          where: whereClause,
          attributes: ['id', 'name', 'unit', 'category', 'description'],
          order: [['name', 'ASC']],
          limit: 50
        });
        
        customCommodities.forEach(commodity => {
          commodities.push({
            ...commodity.toJSON(),
            source: 'custom'
          });
        });
      } catch (error) {
        console.warn('Error fetching custom commodities:', error.message);
      }
    }

    // Sort all commodities by name
    commodities.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: commodities
    });
  } catch (error) {
    console.error('Error fetching commodities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commodities',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get provinces from existing regions table
 */
const getProvinces = async (req, res) => {
  try {
    const provinces = await Region.findAll({
      where: { level: 'province' },
      attributes: ['id', 'province_id', 'province_name'],
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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Download import template with new commodity support
 */
const downloadTemplate = (req, res) => {
  try {
    const templateData = [
      {
        commodity_type: 'existing',
        commodity_id: 1,
        commodity_name: '',
        commodity_unit: '',
        commodity_category: '',
        market_name: 'Pasar Minggu',
        market_type: 'traditional',
        market_location: 'Jl. Raya Pasar Minggu, Jakarta Selatan',
        province_name: 'DKI Jakarta',
        city_name: 'Jakarta Selatan',
        price: 15000,
        quality_grade: 'standard',
        date_recorded: '2025-01-20',
        time_recorded: '08:30:00',
        notes: 'Contoh menggunakan komoditas existing'
      },
      {
        commodity_type: 'new',
        commodity_id: '',
        commodity_name: 'Tempe Lokal Segar',
        commodity_unit: 'kg',
        commodity_category: 'lainnya',
        market_name: 'Pasar Kebayoran',
        market_type: 'traditional',
        market_location: 'Kebayoran Baru, Jakarta Selatan',
        province_name: 'DKI Jakarta',
        city_name: 'Jakarta Selatan',
        price: 12000,
        quality_grade: 'standard',
        date_recorded: '2025-01-20',
        time_recorded: '09:00:00',
        notes: 'Contoh membuat komoditas baru'
      }
    ];

    const headers = Object.keys(templateData[0]);
    const csvContent = [
      headers.join(','),
      ...templateData.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=template-import-market-prices-enhanced.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('Error downloading template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download template',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  uploadImage,
  addMarketPrice,
  getMarketPrices,
  getCommodities,
  getProvinces,
  downloadTemplate
};