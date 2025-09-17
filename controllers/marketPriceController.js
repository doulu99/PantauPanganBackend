const { MarketPrice, Commodity, DataSource, User } = require('../models');
const { Op } = require('sequelize');

const marketPriceController = {
  /**
   * Get market prices with comparison to national prices
   */
  getMarketPrices: async (req, res) => {
    try {
      const {
        commodity_id,
        market_name,
        date = new Date().toISOString().split('T')[0],
        page = 1,
        limit = 20
      } = req.query;

      const whereClause = { date };
      if (commodity_id) whereClause.commodity_id = commodity_id;
      if (market_name) whereClause.market_name = { [Op.like]: `%${market_name}%` };

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows } = await MarketPrice.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Commodity,
            attributes: ['id', 'name', 'unit', 'category']
          },
          {
            model: DataSource,
            attributes: ['id', 'name', 'type', 'location']
          }
        ],
        limit: parseInt(limit),
        offset: offset,
        order: [['commodity_id', 'ASC'], ['market_name', 'ASC']],
        distinct: true
      });

      res.json({
        success: true,
        data: rows,
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
   * Add new market price
   */
  addMarketPrice: async (req, res) => {
    try {
      const {
        commodity_id,
        market_name,
        market_location,
        price,
        date,
        quality_grade,
        notes
      } = req.body;

      // Get or create data source for this market
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

      const marketPrice = await MarketPrice.create({
        commodity_id,
        source_id: source.id,
        market_name,
        market_location,
        price,
        date: date || new Date(),
        quality_grade,
        notes,
        reported_by: req.user?.id,
        evidence_url: req.file?.path
      });

      res.status(201).json({
        success: true,
        message: 'Market price added successfully',
        data: marketPrice
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
   * Compare prices between national (API) and market sources
   */
  comparePrices: async (req, res) => {
    try {
      const {
        commodity_id,
        date = new Date().toISOString().split('T')[0]
      } = req.query;

      // Get national price from Price table
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

      // Get market prices
      const marketPrices = await MarketPrice.findAll({
        where: {
          date,
          ...(commodity_id && { commodity_id })
        },
        include: [
          {
            model: Commodity,
            attributes: ['id', 'name', 'unit', 'category']
          },
          {
            model: DataSource,
            attributes: ['name', 'location']
          }
        ]
      });

      // Group and compare
      const comparison = {};
      
      // Add national prices
      nationalPrices.forEach(price => {
        if (!comparison[price.commodity_id]) {
          comparison[price.commodity_id] = {
            commodity: price.Commodity,
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
        if (!comparison[price.commodity_id]) {
          comparison[price.commodity_id] = {
            commodity: price.Commodity,
            national_price: null,
            market_prices: [],
            average_market_price: 0,
            difference: 0,
            difference_percentage: 0
          };
        }
        
        comparison[price.commodity_id].market_prices.push({
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
        date: {
          [Op.between]: [startDate, endDate]
        }
      };

      // Get national prices
      const nationalPrices = await Price.findAll({
        where: {
          ...whereClause,
          source: 'api'
        },
        order: [['date', 'ASC']],
        attributes: ['date', 'price']
      });

      // Get market prices
      const marketWhereClause = { ...whereClause };
      if (market_name) marketWhereClause.market_name = market_name;

      const marketPrices = await MarketPrice.findAll({
        where: marketWhereClause,
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
          national_prices: nationalPrices,
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