const { Price, Commodity, Region, PriceOverride } = require('../models');
const { syncPricesFromAPI, getPriceComparison } = require('../services/priceSync');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const priceController = {
  /**
   * Get current prices with optional filters
   */
  getCurrentPrices: async (req, res) => {
    try {
      const { 
        date = new Date().toISOString().split('T')[0],
        region_id,
        category,
        search,
        page = 1,
        limit = 20
      } = req.query;

      const whereClause = { date };
      const commodityWhere = {};

      if (region_id) whereClause.region_id = region_id;
      if (category) commodityWhere.category = category;
      if (search) {
        commodityWhere.name = { [Op.like]: `%${search}%` };
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows } = await Price.findAndCountAll({
        where: whereClause,
        include: [{
          model: Commodity,
          where: Object.keys(commodityWhere).length > 0 ? commodityWhere : undefined,
          attributes: ['id', 'name', 'unit', 'category', 'image_url']
        }],
        limit: parseInt(limit),
        offset: offset,
        order: [['commodity_id', 'ASC']],
        distinct: true
      });

      // Get yesterday's prices for comparison
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const yesterdayPrices = await Price.findAll({
        where: { 
          date: yesterdayStr,
          commodity_id: rows.map(p => p.commodity_id)
        },
        attributes: ['commodity_id', 'price']
      });

      const yesterdayMap = {};
      yesterdayPrices.forEach(p => {
        yesterdayMap[p.commodity_id] = p.price;
      });

      // Format response with comparison
      const formattedPrices = rows.map(price => {
        const yesterdayPrice = yesterdayMap[price.commodity_id];
        const gap = yesterdayPrice ? parseFloat(price.price) - parseFloat(yesterdayPrice) : 0;
        const gapPercentage = yesterdayPrice && parseFloat(yesterdayPrice) > 0 
          ? ((gap / parseFloat(yesterdayPrice)) * 100).toFixed(2) 
          : 0;

        return {
          id: price.id,
          commodity: price.Commodity,
          commodity_id: price.commodity_id,
          price: parseFloat(price.price),
          yesterday_price: yesterdayPrice ? parseFloat(yesterdayPrice) : null,
          gap: parseFloat(gap.toFixed(2)),
          gap_percentage: parseFloat(gapPercentage),
          gap_change: gap > 0 ? 'up' : gap < 0 ? 'down' : 'stable',
          source: price.source,
          is_override: price.is_override,
          date: price.date,
          level: price.level
        };
      });

      res.json({
        success: true,
        data: formattedPrices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching current prices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch current prices',
        error: error.message
      });
    }
  },

  /**
   * Get price history for a specific commodity
   */
  getPriceHistory: async (req, res) => {
    try {
      const { commodityId } = req.params;
      const { 
        start_date,
        end_date,
        region_id
      } = req.query;

      const whereClause = { commodity_id: commodityId };
      
      if (start_date && end_date) {
        whereClause.date = {
          [Op.between]: [start_date, end_date]
        };
      } else {
        // Default to last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        whereClause.date = {
          [Op.between]: [
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
          ]
        };
      }

      if (region_id) whereClause.region_id = region_id;

      const prices = await Price.findAll({
        where: whereClause,
        order: [['date', 'ASC']],
        attributes: ['id', 'price', 'date', 'source', 'is_override']
      });

      // Get commodity info
      const commodity = await Commodity.findByPk(commodityId);

      // Calculate statistics
      const priceValues = prices.map(p => parseFloat(p.price));
      const stats = priceValues.length > 0 ? {
        min: Math.min(...priceValues),
        max: Math.max(...priceValues),
        avg: parseFloat((priceValues.reduce((a, b) => a + b, 0) / priceValues.length).toFixed(2)),
        current: priceValues[priceValues.length - 1],
        change_percentage: priceValues.length > 1 
          ? (((priceValues[priceValues.length - 1] - priceValues[0]) / priceValues[0]) * 100).toFixed(2)
          : 0
      } : {
        min: 0,
        max: 0,
        avg: 0,
        current: 0,
        change_percentage: 0
      };

      res.json({
        success: true,
        data: {
          commodity: commodity,
          commodity_id: commodityId,
          history: prices,
          statistics: stats
        }
      });
    } catch (error) {
      console.error('Error fetching price history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch price history',
        error: error.message
      });
    }
  },

  /**
   * Get price comparison between API and manual overrides
   */
  getPriceComparison: async (req, res) => {
    try {
      const { date = new Date() } = req.query;
      const comparison = await getPriceComparison(new Date(date));
      
      res.json({
        success: true,
        data: comparison,
        date: date
      });
    } catch (error) {
      console.error('Error getting price comparison:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get price comparison',
        error: error.message
      });
    }
  },

  /**
   * Get price statistics
   */
  getPriceStatistics: async (req, res) => {
    try {
      const { period = '7d', region_id } = req.query;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch(period) {
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      const whereClause = {
        date: {
          [Op.between]: [
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
          ]
        }
      };

      if (region_id) whereClause.region_id = region_id;

      // Get aggregated statistics
      const stats = await Price.findAll({
        where: whereClause,
        attributes: [
          'commodity_id',
          [sequelize.fn('AVG', sequelize.col('price')), 'avg_price'],
          [sequelize.fn('MIN', sequelize.col('price')), 'min_price'],
          [sequelize.fn('MAX', sequelize.col('price')), 'max_price'],
          [sequelize.fn('COUNT', sequelize.col('Price.id')), 'data_points']
        ],
        include: [{
          model: Commodity,
          attributes: ['name', 'category']
        }],
        group: ['commodity_id', 'Commodity.id', 'Commodity.name', 'Commodity.category'],
        raw: false
      });

      // Format stats
      const formattedStats = stats.map(stat => ({
        commodity_id: stat.commodity_id,
        commodity_name: stat.Commodity?.name,
        commodity_category: stat.Commodity?.category,
        avg_price: parseFloat(stat.dataValues.avg_price || 0),
        min_price: parseFloat(stat.dataValues.min_price || 0),
        max_price: parseFloat(stat.dataValues.max_price || 0),
        data_points: parseInt(stat.dataValues.data_points || 0)
      }));

      // Get top movers
      let topMovers = [];
      try {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Get first and last prices for each commodity
        const firstPrices = await Price.findAll({
          where: { date: startDateStr },
          include: [{
            model: Commodity,
            attributes: ['name', 'category']
          }]
        });

        const lastPrices = await Price.findAll({
          where: { date: endDateStr },
          include: [{
            model: Commodity,
            attributes: ['name', 'category']
          }]
        });

        // Create price maps
        const firstPriceMap = {};
        firstPrices.forEach(p => {
          firstPriceMap[p.commodity_id] = {
            price: parseFloat(p.price),
            commodity: p.Commodity
          };
        });

        const lastPriceMap = {};
        lastPrices.forEach(p => {
          lastPriceMap[p.commodity_id] = {
            price: parseFloat(p.price),
            commodity: p.Commodity
          };
        });

        // Calculate top movers
        Object.keys(lastPriceMap).forEach(commodityId => {
          if (firstPriceMap[commodityId]) {
            const startPrice = firstPriceMap[commodityId].price;
            const endPrice = lastPriceMap[commodityId].price;
            const changePercent = ((endPrice - startPrice) / startPrice * 100).toFixed(2);

            topMovers.push({
              id: commodityId,
              name: lastPriceMap[commodityId].commodity?.name,
              category: lastPriceMap[commodityId].commodity?.category,
              start_price: startPrice,
              end_price: endPrice,
              change_percentage: parseFloat(changePercent)
            });
          }
        });

        // Sort by absolute change percentage
        topMovers.sort((a, b) => Math.abs(b.change_percentage) - Math.abs(a.change_percentage));
        topMovers = topMovers.slice(0, 10);

      } catch (error) {
        console.error('Error calculating top movers:', error);
      }

      res.json({
        success: true,
        data: {
          period,
          date_range: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
          },
          statistics: formattedStats,
          top_movers: topMovers
        }
      });
    } catch (error) {
      console.error('Error getting price statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get price statistics',
        error: error.message
      });
    }
  },

  /**
   * Manually trigger price sync
   */
  syncPrices: async (req, res) => {
    try {
      const { province_id, city_id, level_harga_id } = req.body;
      
      const result = await syncPricesFromAPI({
        provinceId: province_id,
        cityId: city_id,
        levelHargaId: level_harga_id || 3
      });

      res.json({
        success: true,
        message: 'Price synchronization completed',
        data: result
      });
    } catch (error) {
      console.error('Error syncing prices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync prices',
        error: error.message
      });
    }
  },

  /**
   * Export prices to CSV/JSON
   */
  exportPrices: async (req, res) => {
    try {
      const { start_date, end_date, format = 'json' } = req.query;
      
      const whereClause = {};
      if (start_date && end_date) {
        whereClause.date = {
          [Op.between]: [start_date, end_date]
        };
      }

      const prices = await Price.findAll({
        where: whereClause,
        include: [{
          model: Commodity,
          attributes: ['name', 'unit', 'category']
        }],
        order: [['date', 'DESC'], ['commodity_id', 'ASC']]
      });

      if (format === 'csv') {
        // Convert to CSV format
        const csv = [
          'Date,Commodity,Category,Unit,Price,Source,Is Override',
          ...prices.map(p => 
            `${p.date},"${p.Commodity.name}",${p.Commodity.category},${p.Commodity.unit},${p.price},${p.source},${p.is_override}`
          )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=price-export-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
      } else {
        res.json({
          success: true,
          data: prices
        });
      }
    } catch (error) {
      console.error('Error exporting prices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export prices',
        error: error.message
      });
    }
  }
};

module.exports = priceController;