// controllers/marketPriceController.js - Updated version
const { MarketPrice, Commodity, DataSource, User, CustomCommodity } = require('../models');
const { Op } = require('sequelize');

const marketPriceController = {
  /**
   * Get market prices with comparison to national prices
   */
  getMarketPrices: async (req, res) => {
    try {
      const {
        commodity_id,
        commodity_source,
        market_name,
        date = new Date().toISOString().split('T')[0],
        page = 1,
        limit = 20
      } = req.query;

      const whereClause = { date };
      if (commodity_id) whereClause.commodity_id = commodity_id;
      if (commodity_source) whereClause.commodity_source = commodity_source;
      if (market_name) whereClause.market_name = { [Op.like]: `%${market_name}%` };

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows } = await MarketPrice.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Commodity,
            required: false,
            attributes: ['id', 'name', 'unit', 'category']
          },
          {
            model: CustomCommodity,
            as: 'custom_commodity',
            required: false,
            attributes: ['id', 'name', 'unit', 'category']
          },
          {
            model: DataSource,
            required: false,
            attributes: ['id', 'name', 'type', 'location']
          }
        ],
        limit: parseInt(limit),
        offset: offset,
        order: [['date', 'DESC'], ['commodity_id', 'ASC']],
        distinct: true
      });

      // Enrich data dengan informasi komoditas yang tepat
      const enrichedRows = rows.map(price => {
        let commodity = null;
        
        if (price.commodity_source === 'custom' && price.custom_commodity) {
          commodity = {
            ...price.custom_commodity.toJSON(),
            source: 'custom'
          };
        } else if (price.commodity_source === 'national' && price.Commodity) {
          commodity = {
            ...price.Commodity.toJSON(),
            source: 'national'
          };
        }
        
        return {
          ...price.toJSON(),
          commodity
        };
      });

      res.json({
        success: true,
        data: enrichedRows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching market prices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch market prices',
        error: error.message
      });
    }
  },

  /**
   * Add new market price - Updated untuk support custom commodities
   */
  addMarketPrice: async (req, res) => {
    try {
      const {
        commodity_id,
        commodity_source = 'national',
        market_name,
        market_location,
        price,
        date,
        quality_grade,
        notes
      } = req.body;

      // Validasi input
      if (!commodity_id || !market_name || !price || !date) {
        return res.status(400).json({
          success: false,
          message: 'Field commodity_id, market_name, price, dan date wajib diisi'
        });
      }

      // Validasi commodity exists
      let commodity = null;
      if (commodity_source === 'custom') {
        commodity = await CustomCommodity.findOne({
          where: { id: commodity_id, is_active: true }
        });
        if (!commodity) {
          return res.status(400).json({
            success: false,
            message: 'Komoditas custom tidak ditemukan'
          });
        }
      } else {
        commodity = await Commodity.findByPk(commodity_id);
        if (!commodity) {
          return res.status(400).json({
            success: false,
            message: 'Komoditas nasional tidak ditemukan'
          });
        }
      }

      // Get or create data source for this market (optional)
      let source_id = null;
      if (commodity_source === 'national') {
        const [source] = await DataSource.findOrCreate({
          where: { 
            code: market_name.toLowerCase().replace(/\s+/g, '_')
          },
          defaults: {
            name: market_name,
            type: 'market',
            location: market_location,
            description: `Pasar ${market_name}`
          }
        });
        source_id = source.id;
      }

      const marketPrice = await MarketPrice.create({
        commodity_id,
        commodity_source,
        source_id,
        market_name,
        market_location,
        price: parseFloat(price),
        date: date || new Date(),
        quality_grade,
        notes,
        reported_by: req.user?.id,
        evidence_url: req.file?.path
      });

      // Load dengan commodity info
      const marketPriceWithCommodity = await MarketPrice.findByPk(marketPrice.id, {
        include: [
          {
            model: Commodity,
            required: false
          },
          {
            model: CustomCommodity,
            as: 'custom_commodity',
            required: false
          }
        ]
      });

      // Format response
      let commodityInfo = null;
      if (commodity_source === 'custom') {
        commodityInfo = {
          ...marketPriceWithCommodity.custom_commodity?.toJSON(),
          source: 'custom'
        };
      } else {
        commodityInfo = {
          ...marketPriceWithCommodity.Commodity?.toJSON(),
          source: 'national'
        };
      }

      res.status(201).json({
        success: true,
        message: 'Market price added successfully',
        data: {
          ...marketPriceWithCommodity.toJSON(),
          commodity: commodityInfo
        }
      });
    } catch (error) {
      console.error('Error adding market price:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add market price',
        error: error.message
      });
    }
  },

  /**
   * Update market price - NEW
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
        notes
      } = req.body;

      const marketPrice = await MarketPrice.findByPk(id);
      if (!marketPrice) {
        return res.status(404).json({
          success: false,
          message: 'Market price not found'
        });
      }

      // Check permission (only reporter or admin can update)
      if (req.user?.id !== marketPrice.reported_by && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      await marketPrice.update({
        market_name: market_name || marketPrice.market_name,
        market_location: market_location !== undefined ? market_location : marketPrice.market_location,
        price: price !== undefined ? parseFloat(price) : marketPrice.price,
        date: date || marketPrice.date,
        quality_grade: quality_grade || marketPrice.quality_grade,
        notes: notes !== undefined ? notes : marketPrice.notes
      });

      res.json({
        success: true,
        message: 'Market price updated successfully',
        data: marketPrice
      });
    } catch (error) {
      console.error('Error updating market price:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update market price',
        error: error.message
      });
    }
  },

  /**
   * Delete market price - NEW
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

      // Check permission (only reporter or admin can delete)
      if (req.user?.id !== marketPrice.reported_by && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      await marketPrice.destroy();

      res.json({
        success: true,
        message: 'Market price deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting market price:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete market price',
        error: error.message
      });
    }
  },

  /**
   * Get market price statistics - NEW
   */
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
      console.error('Error fetching market stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch market statistics',
        error: error.message
      });
    }
  },

  /**
   * Compare prices between national (API) and market sources - Updated
   */
  comparePrices: async (req, res) => {
    try {
      const {
        commodity_id,
        date = new Date().toISOString().split('T')[0]
      } = req.query;

      // Get national price from Price table
      const { Price } = require('../models');
      const nationalPrices = await Price.findAll({
        where: {
          date,
          source: 'api',
          ...(commodity_id && { commodity_id })
        },
        include: [{
          model: Commodity,
          attributes: ['id', 'name', 'unit', 'category']
        }]
      });

      // Get market prices (both national and custom commodities)
      const marketPricesWhere = { date };
      if (commodity_id) marketPricesWhere.commodity_id = commodity_id;

      const marketPrices = await MarketPrice.findAll({
        where: marketPricesWhere,
        include: [
          {
            model: Commodity,
            required: false,
            attributes: ['id', 'name', 'unit', 'category']
          },
          {
            model: CustomCommodity,
            as: 'custom_commodity',
            required: false,
            attributes: ['id', 'name', 'unit', 'category']
          },
          {
            model: DataSource,
            required: false,
            attributes: ['name', 'location']
          }
        ]
      });

      // Group and compare
      const comparison = {};
      
      // Add national prices
      nationalPrices.forEach(price => {
        const key = `national_${price.commodity_id}`;
        if (!comparison[key]) {
          comparison[key] = {
            commodity_id: price.commodity_id,
            commodity: {
              ...price.Commodity.toJSON(),
              source: 'national'
            },
            national_price: parseFloat(price.price),
            market_prices: [],
            average_market_price: 0,
            difference: 0,
            difference_percentage: 0
          };
        }
      });

      // Add market prices and calculate averages
      marketPrices.forEach(price => {
        const key = `${price.commodity_source}_${price.commodity_id}`;
        
        let commodity = null;
        if (price.commodity_source === 'custom' && price.custom_commodity) {
          commodity = {
            ...price.custom_commodity.toJSON(),
            source: 'custom'
          };
        } else if (price.commodity_source === 'national' && price.Commodity) {
          commodity = {
            ...price.Commodity.toJSON(),
            source: 'national'
          };
        }

        if (!comparison[key]) {
          comparison[key] = {
            commodity_id: price.commodity_id,
            commodity,
            national_price: null,
            market_prices: [],
            average_market_price: 0,
            difference: 0,
            difference_percentage: 0
          };
        }
        
        comparison[key].market_prices.push({
          market_name: price.market_name,
          location: price.market_location,
          price: parseFloat(price.price),
          quality_grade: price.quality_grade,
          source: price.DataSource
        });
      });

      // Calculate averages and differences
      Object.values(comparison).forEach(item => {
        if (item.market_prices.length > 0) {
          const total = item.market_prices.reduce((sum, mp) => sum + mp.price, 0);
          item.average_market_price = parseFloat((total / item.market_prices.length).toFixed(2));
          
          if (item.national_price) {
            item.difference = item.average_market_price - item.national_price;
            item.difference_percentage = parseFloat(
              ((item.difference / item.national_price) * 100).toFixed(2)
            );
          }
        }
      });

      res.json({
        success: true,
        data: Object.values(comparison),
        summary: {
          total_commodities: Object.keys(comparison).length,
          average_difference: Object.values(comparison)
            .filter(c => c.national_price && c.average_market_price)
            .reduce((sum, c) => sum + c.difference_percentage, 0) / 
            Object.values(comparison).filter(c => c.national_price && c.average_market_price).length || 0,
          date
        }
      });
    } catch (error) {
      console.error('Error comparing prices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to compare prices',
        error: error.message
      });
    }
  },

  /**
   * Get price trends comparing national vs market
   */
  getPriceTrends: async (req, res) => {
    try {
      const {
        commodity_id,
        commodity_source = 'national',
        start_date,
        end_date,
        market_name
      } = req.query;

      const endDate = end_date || new Date().toISOString().split('T')[0];
      const startDate = start_date || (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
      })();

      const whereClause = {
        commodity_id,
        commodity_source,
        date: {
          [Op.between]: [startDate, endDate]
        }
      };

      if (market_name) whereClause.market_name = market_name;

      const marketPrices = await MarketPrice.findAll({
        where: whereClause,
        order: [['date', 'ASC']],
        attributes: ['date', 'price', 'market_name']
      });

      // Group market prices by date and calculate average
      const marketPricesByDate = {};
      marketPrices.forEach(mp => {
        if (!marketPricesByDate[mp.date]) {
          marketPricesByDate[mp.date] = [];
        }
        marketPricesByDate[mp.date].push(parseFloat(mp.price));
      });

      const averageMarketPrices = Object.keys(marketPricesByDate).map(date => ({
        date,
        price: marketPricesByDate[date].reduce((a, b) => a + b, 0) / marketPricesByDate[date].length
      }));

      res.json({
        success: true,
        data: {
          market_prices: averageMarketPrices,
          raw_market_prices: marketPrices,
          date_range: {
            start: startDate,
            end: endDate
          }
        }
      });
    } catch (error) {
      console.error('Error getting price trends:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get price trends',
        error: error.message
      });
    }
  }
};

module.exports = marketPriceController;