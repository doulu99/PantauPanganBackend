// controllers/marketPriceController.js - ENHANCED WITH IMAGE SUPPORT
const { MarketPrice, Commodity, DataSource, User, CustomCommodity } = require('../models');
const { Op } = require('sequelize');
const { getImageUrl, deleteImage, getFilenameFromUrl } = require('../middleware/upload');

const marketPriceController = {
  /**
   * Get market prices with images
   */
  getMarketPrices: async (req, res) => {
    try {
      console.log('📋 Request query params:', req.query);
      
      const {
        commodity_id,
        commodity_source,
        market_name,
        date_from,
        date_to,
        date = new Date().toISOString().split('T')[0],
        page = 1,
        limit = 20,
        period = 'today',
        category = '',
        market = '',
        search = '',
        quality_grade = ''
      } = req.query;

      // Build where clause
      const whereClause = {};
      
      // Handle date filtering based on period
      if (period === 'today') {
        whereClause.date = date;
      } else if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        whereClause.date = {
          [Op.between]: [weekAgo.toISOString().split('T')[0], date]
        };
      } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        whereClause.date = {
          [Op.between]: [monthAgo.toISOString().split('T')[0], date]
        };
      } else if (date_from && date_to) {
        whereClause.date = {
          [Op.between]: [date_from, date_to]
        };
      }

      // Add other filters
      if (commodity_id) whereClause.commodity_id = commodity_id;
      if (commodity_source) whereClause.commodity_source = commodity_source;
      if (market_name || market) {
        const marketSearch = market_name || market;
        whereClause.market_name = { [Op.like]: `%${marketSearch}%` };
      }
      if (quality_grade) whereClause.quality_grade = quality_grade;
      
      // Search filter
      if (search) {
        whereClause[Op.or] = [
          { market_name: { [Op.like]: `%${search}%` } },
          { market_location: { [Op.like]: `%${search}%` } },
          { notes: { [Op.like]: `%${search}%` } }
        ];
      }

      console.log('🔍 Where clause:', JSON.stringify(whereClause, null, 2));

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build include array for non-commodity associations
      const includeArray = [];
      
      try {
        includeArray.push({
          model: DataSource,
          required: false,
          attributes: ['id', 'name', 'type', 'location']
        });
      } catch (error) {
        console.warn('⚠️ DataSource model not available:', error.message);
      }

      try {
        includeArray.push({
          model: User,
          as: 'reporter',
          required: false,
          attributes: ['id', 'full_name', 'username']
        });
      } catch (error) {
        console.warn('⚠️ User model not available for reporter:', error.message);
      }

      console.log('📊 Executing main query...');

      // Execute main query
      const result = await MarketPrice.findAndCountAll({
        where: whereClause,
        include: includeArray,
        limit: parseInt(limit),
        offset: offset,
        order: [['date', 'DESC'], ['id', 'DESC']],
        distinct: true
      });

      const { count, rows } = result;
      console.log(`✅ Found ${count} records, returned ${rows.length}`);

      // Smart commodity detection with image processing
      const enrichedRows = await Promise.all(rows.map(async (price) => {
        const priceData = price.toJSON ? price.toJSON() : price;
        let commodity = null;
        let actualCommoditySource = priceData.commodity_source;
        let needsDatabaseUpdate = false;

        console.log(`🔍 Processing price ID ${priceData.id} - commodity_id: ${priceData.commodity_id}, source: ${priceData.commodity_source}`);

        try {
          // Smart commodity detection (same logic as before)
          let customCommodity = null;
          let nationalCommodity = null;

          if (CustomCommodity) {
            customCommodity = await CustomCommodity.findByPk(priceData.commodity_id, {
              attributes: ['id', 'name', 'unit', 'category', 'description'],
              where: { is_active: true }
            });
          }

          if (Commodity) {
            nationalCommodity = await Commodity.findByPk(priceData.commodity_id, {
              attributes: ['id', 'name', 'unit', 'category']
            });
          }

          // Priority logic: Custom commodities take priority
          if (customCommodity && nationalCommodity) {
            commodity = customCommodity;
            actualCommoditySource = 'custom';
            if (priceData.commodity_source !== 'custom') {
              needsDatabaseUpdate = true;
            }
          } else if (customCommodity) {
            commodity = customCommodity;
            actualCommoditySource = 'custom';
            if (priceData.commodity_source !== 'custom') {
              needsDatabaseUpdate = true;
            }
          } else if (nationalCommodity) {
            commodity = nationalCommodity;
            actualCommoditySource = 'national';
            if (priceData.commodity_source !== 'national') {
              needsDatabaseUpdate = true;
            }
          }

          // Update database if needed
          if (needsDatabaseUpdate && commodity) {
            try {
              await MarketPrice.update(
                { commodity_source: actualCommoditySource },
                { where: { id: priceData.id } }
              );
              console.log(`✅ Updated database: Price ID ${priceData.id} commodity_source → ${actualCommoditySource}`);
            } catch (updateError) {
              console.warn(`⚠️ Could not update commodity_source for price ID ${priceData.id}:`, updateError.message);
            }
          }

          // Fallback if no commodity found
          if (!commodity) {
            commodity = {
              id: priceData.commodity_id,
              name: 'Commodity Not Found',
              unit: 'kg',
              category: 'lainnya',
              source: actualCommoditySource
            };
          } else {
            commodity = {
              ...commodity.toJSON(),
              source: actualCommoditySource
            };
          }

        } catch (error) {
          console.error(`❌ Error in smart commodity detection for price ${priceData.id}:`, error.message);
          commodity = {
            id: priceData.commodity_id,
            name: 'Error Loading Commodity',
            unit: 'kg',
            category: 'lainnya',
            source: priceData.commodity_source || 'unknown'
          };
        }

        // Process images - Convert file paths to URLs
        let images = [];
        if (priceData.evidence_url) {
          // Handle single image (legacy)
          const imageUrl = getImageUrl(req, path.basename(priceData.evidence_url));
          if (imageUrl) {
            images.push({
              url: imageUrl,
              filename: path.basename(priceData.evidence_url),
              type: 'evidence'
            });
          }
        }

        // Handle multiple images if stored in images field
        if (priceData.images) {
          try {
            const imageList = typeof priceData.images === 'string' 
              ? JSON.parse(priceData.images) 
              : priceData.images;
              
            if (Array.isArray(imageList)) {
              imageList.forEach(imagePath => {
                const imageUrl = getImageUrl(req, path.basename(imagePath));
                if (imageUrl) {
                  images.push({
                    url: imageUrl,
                    filename: path.basename(imagePath),
                    type: 'additional'
                  });
                }
              });
            }
          } catch (parseError) {
            console.warn(`⚠️ Could not parse images for price ${priceData.id}:`, parseError.message);
          }
        }

        return {
          ...priceData,
          commodity_source: actualCommoditySource,
          commodity,
          images, // Add images array
          // Keep evidence_url for backward compatibility but also provide image URLs
          evidence_url: priceData.evidence_url ? getImageUrl(req, path.basename(priceData.evidence_url)) : null
        };
      }));

      // Calculate pagination info
      const totalPages = Math.ceil(count / parseInt(limit));

      console.log('✅ Successfully processed market prices with images:', {
        total: count,
        returned: enrichedRows.length,
        page: parseInt(page),
        totalPages
      });

      res.json({
        success: true,
        message: 'Market prices retrieved successfully',
        data: enrichedRows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      });

    } catch (error) {
      console.error('❌ Error in getMarketPrices:', error);
      console.error('Stack trace:', error.stack);
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch market prices',
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : 'Internal server error'
      });
    }
  },

  /**
   * Add new market price with image support
   */
  addMarketPrice: async (req, res) => {
    try {
      const {
        commodity_id,
        commodity_source,
        market_name,
        market_location,
        price,
        date,
        quality_grade = 'standard',
        notes
      } = req.body;

      console.log('📝 Adding market price with image:', {
        ...req.body,
        hasFile: !!req.file,
        hasFiles: !!(req.files && req.files.length)
      });

      // Validation
      if (!commodity_id || !market_name || !price) {
        return res.status(400).json({
          success: false,
          message: 'Commodity ID, market name, and price are required'
        });
      }

      // Smart commodity detection (same logic as before)
      let detectedCommoditySource = null;
      let commodity = null;

      let customCommodity = null;
      let nationalCommodity = null;

      if (CustomCommodity) {
        customCommodity = await CustomCommodity.findOne({
          where: { id: commodity_id, is_active: true }
        });
      }

      if (Commodity) {
        nationalCommodity = await Commodity.findByPk(commodity_id);
      }

      // Priority logic
      if (commodity_source === 'custom' && customCommodity) {
        commodity = customCommodity;
        detectedCommoditySource = 'custom';
      } else if (commodity_source === 'national' && nationalCommodity) {
        commodity = nationalCommodity;
        detectedCommoditySource = 'national';
      } else if (customCommodity && nationalCommodity) {
        commodity = customCommodity;
        detectedCommoditySource = 'custom';
      } else if (customCommodity) {
        commodity = customCommodity;
        detectedCommoditySource = 'custom';
      } else if (nationalCommodity) {
        commodity = nationalCommodity;
        detectedCommoditySource = 'national';
      } else {
        return res.status(400).json({
          success: false,
          message: `Commodity with ID ${commodity_id} not found in any source`
        });
      }

      // Get or create data source
      let source_id = null;
      try {
        if (DataSource) {
          const [source] = await DataSource.findOrCreate({
            where: { 
              code: market_name.toLowerCase().replace(/\s+/g, '_')
            },
            defaults: {
              name: market_name,
              type: 'market',
              location: market_location,
              description: `Market: ${market_name}`
            }
          });
          source_id = source.id;
        }
      } catch (error) {
        console.warn('⚠️ Could not create/find data source:', error.message);
      }

      // Handle image uploads
      let evidence_url = null;
      let images = [];

      if (req.file) {
        // Single image upload
        evidence_url = req.file.filename;
        console.log(`📷 Single image uploaded: ${evidence_url}`);
      }

      if (req.files && req.files.length > 0) {
        // Multiple images upload
        images = req.files.map(file => file.filename);
        console.log(`📷 Multiple images uploaded: ${images.join(', ')}`);
        
        // If no single evidence_url, use first image as evidence
        if (!evidence_url && images.length > 0) {
          evidence_url = images[0];
        }
      }

      // Create market price
      const marketPrice = await MarketPrice.create({
        commodity_id,
        commodity_source: detectedCommoditySource,
        source_id,
        market_name,
        market_location,
        price: parseFloat(price),
        date: date || new Date(),
        quality_grade,
        notes,
        reported_by: req.user?.id,
        evidence_url, // Main image
        images: images.length > 0 ? JSON.stringify(images) : null // Additional images as JSON
      });

      console.log(`✅ Created market price with ID: ${marketPrice.id}, images: ${images.length}`);

      // Format response with commodity info and image URLs
      const commodityInfo = {
        ...commodity.toJSON(),
        source: detectedCommoditySource
      };

      // Create image URLs for response
      const imageUrls = images.map(filename => ({
        url: getImageUrl(req, filename),
        filename,
        type: filename === evidence_url ? 'evidence' : 'additional'
      }));

      res.status(201).json({
        success: true,
        message: 'Market price added successfully',
        data: {
          ...marketPrice.toJSON(),
          commodity: commodityInfo,
          images: imageUrls,
          evidence_url: evidence_url ? getImageUrl(req, evidence_url) : null
        }
      });
      
    } catch (error) {
      console.error('❌ Error adding market price:', error);
      
      // Clean up uploaded files if database save failed
      if (req.file) {
        deleteImage(req.file.filename);
      }
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => deleteImage(file.filename));
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to add market price',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * Update market price with image support
   */
  updateMarketPrice: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        market_name,
        market_location,
        price,
        date,
        quality_grade,
        notes,
        remove_images // Array of image filenames to remove
      } = req.body;

      const marketPrice = await MarketPrice.findByPk(id);
      if (!marketPrice) {
        return res.status(404).json({
          success: false,
          message: 'Market price not found'
        });
      }

      // Check permission
      if (req.user && req.user.id !== marketPrice.reported_by && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      // Handle image updates
      let currentImages = [];
      if (marketPrice.images) {
        try {
          currentImages = JSON.parse(marketPrice.images);
        } catch (e) {
          currentImages = [];
        }
      }

      // Remove specified images
      if (remove_images && Array.isArray(remove_images)) {
        remove_images.forEach(filename => {
          deleteImage(filename);
          currentImages = currentImages.filter(img => img !== filename);
        });
      }

      // Add new images
      if (req.files && req.files.length > 0) {
        const newImages = req.files.map(file => file.filename);
        currentImages = [...currentImages, ...newImages];
      }

      // Handle main evidence image
      let evidence_url = marketPrice.evidence_url;
      if (req.file) {
        // Delete old evidence image if exists
        if (evidence_url) {
          deleteImage(getFilenameFromUrl(evidence_url));
        }
        evidence_url = req.file.filename;
      }

      // Update market price
      const updateData = {
        market_name: market_name || marketPrice.market_name,
        market_location: market_location !== undefined ? market_location : marketPrice.market_location,
        price: price !== undefined ? parseFloat(price) : marketPrice.price,
        date: date || marketPrice.date,
        quality_grade: quality_grade || marketPrice.quality_grade,
        notes: notes !== undefined ? notes : marketPrice.notes,
        images: currentImages.length > 0 ? JSON.stringify(currentImages) : null
      };

      if (evidence_url !== marketPrice.evidence_url) {
        updateData.evidence_url = evidence_url;
      }

      await marketPrice.update(updateData);

      // Create image URLs for response
      const imageUrls = currentImages.map(filename => ({
        url: getImageUrl(req, filename),
        filename,
        type: filename === evidence_url ? 'evidence' : 'additional'
      }));

      res.json({
        success: true,
        message: 'Market price updated successfully',
        data: {
          ...marketPrice.toJSON(),
          images: imageUrls,
          evidence_url: evidence_url ? getImageUrl(req, evidence_url) : null
        }
      });
    } catch (error) {
      console.error('❌ Error updating market price:', error);
      
      // Clean up uploaded files if update failed
      if (req.file) {
        deleteImage(req.file.filename);
      }
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => deleteImage(file.filename));
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update market price',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * Delete market price with image cleanup
   */
  deleteMarketPrice: async (req, res) => {
    try {
      const { id } = req.params;

      const marketPrice = await MarketPrice.findByPk(id);
      if (!marketPrice) {
        return res.status(404).json({
          success: false,
          message: 'Market price not found'
        });
      }

      // Check permission
      if (req.user && req.user.id !== marketPrice.reported_by && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      // Delete associated images
      if (marketPrice.evidence_url) {
        deleteImage(getFilenameFromUrl(marketPrice.evidence_url));
      }

      if (marketPrice.images) {
        try {
          const imageList = JSON.parse(marketPrice.images);
          imageList.forEach(filename => deleteImage(filename));
        } catch (e) {
          console.warn('Could not parse images for deletion:', e.message);
        }
      }

      await marketPrice.destroy();

      res.json({
        success: true,
        message: 'Market price and associated images deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting market price:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete market price',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Include other methods (getMarketStats, comparePrices) from previous version
  getMarketStats: async (req, res) => {
    try {
      const { 
        period = 'today', 
        category,
        market 
      } = req.query;

      let dateWhere = {};
      const today = new Date();
      
      switch(period) {
        case 'today':
          dateWhere.date = today.toISOString().split('T')[0];
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          dateWhere.date = {
            [Op.between]: [weekAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]]
          };
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          dateWhere.date = {
            [Op.between]: [monthAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]]
          };
          break;
      }

      const whereClause = { ...dateWhere };
      if (market) {
        whereClause.market_name = { [Op.like]: `%${market}%` };
      }

      const totalRecords = await MarketPrice.count({ where: whereClause });
      const uniqueMarkets = await MarketPrice.count({
        where: whereClause,
        distinct: true,
        col: 'market_name'
      });

      const avgPrice = await MarketPrice.findOne({
        where: whereClause,
        attributes: [
          [require('sequelize').fn('AVG', require('sequelize').col('price')), 'avg_price']
        ]
      });

      const priceRange = await MarketPrice.findOne({
        where: whereClause,
        attributes: [
          [require('sequelize').fn('MIN', require('sequelize').col('price')), 'min_price'],
          [require('sequelize').fn('MAX', require('sequelize').col('price')), 'max_price']
        ]
      });

      res.json({
        success: true,
        data: {
          total_entries: totalRecords,
          markets_count: uniqueMarkets,
          avg_price: parseFloat(avgPrice?.dataValues?.avg_price || 0),
          price_range: {
            min: parseFloat(priceRange?.dataValues?.min_price || 0),
            max: parseFloat(priceRange?.dataValues?.max_price || 0)
          }
        }
      });
    } catch (error) {
      console.error('❌ Error fetching market stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch market statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  comparePrices: async (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Price comparison feature available',
        data: []
      });
    } catch (error) {
      console.error('❌ Error comparing prices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to compare prices',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

module.exports = marketPriceController;