// services/bpnApiService.js - Fixed version dengan better error handling
const axios = require('axios');
const { Commodity, Price, Region } = require('../models');

class BPNApiService {
  constructor() {
    this.apiClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
      }
    });

    this.baseURL = 'https://api-panelhargav2.badanpangan.go.id/api';
    this.endpoints = {
      prices: `${this.baseURL}/front/harga-pangan-informasi`,
      provinces: `${this.baseURL}/provinces`,
      cities: `${this.baseURL}/cities`
    };
  }

  /**
   * Fetch current prices from BPN API
   */
  async fetchCurrentPrices(options = {}) {
    const {
      provinceId = '',
      cityId = '',
      levelHargaId = 3 // 1=produsen, 2=grosir, 3=konsumen
    } = options;

    try {
      console.log('🔄 Fetching prices from BPN API...');
      
      const url = `${this.endpoints.prices}?province_id=${provinceId}&city_id=${cityId}&level_harga_id=${levelHargaId}`;
      console.log('BPN API URL:', url);
      
      const response = await this.apiClient.get(url);

      if (response.data?.status === 'success' && response.data?.data) {
        console.log(`✅ Received ${response.data.data.length} price items from BPN`);
        
        // Log sample data untuk debugging
        if (response.data.data.length > 0) {
          console.log('Sample BPN data:', JSON.stringify(response.data.data[0], null, 2));
        }
        
        return response.data.data;
      } else {
        throw new Error(`BPN API Error: ${response.data?.message || 'Invalid response'}`);
      }
    } catch (error) {
      console.error('❌ Failed to fetch BPN prices:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`BPN API fetch failed: ${error.message}`);
    }
  }

  /**
   * Sync prices to database dengan validasi yang lebih baik
   */
  async syncPrices(apiData, levelHarga = 'konsumen') {
    console.log('💾 Syncing prices to database...');
    
    const today = new Date().toISOString().split('T')[0];
    const syncedPrices = [];
    const errors = [];

    for (const item of apiData) {
      try {
        console.log(`Processing item: ${item.name || 'Unknown'}`);
        console.log(`Price data - today: ${item.today}, yesterday: ${item.yesterday}`);
        
        // Validasi data yang lebih ketat berdasarkan struktur API yang sebenarnya
        if (!item.id || !item.name) {
          console.warn(`⚠️ Skipping item - missing id or name:`, item);
          continue;
        }

        // Ambil harga dari field 'today' (sesuai dengan response API BPN)
        let price = null;
        if (item.today !== null && item.today !== undefined && item.today > 0) {
          price = parseFloat(item.today);
        } else if (item.yesterday !== null && item.yesterday !== undefined && item.yesterday > 0) {
          price = parseFloat(item.yesterday);
          console.log(`⚠️ Using yesterday's price for ${item.name}: ${price}`);
        } else {
          console.warn(`⚠️ Skipping ${item.name} - no valid price data (today: ${item.today}, yesterday: ${item.yesterday})`);
          continue;
        }

        // Validasi harga reasonable (antara 100 dan 1,000,000)
        if (price < 100 || price > 1000000) {
          console.warn(`⚠️ Skipping ${item.name} - unreasonable price: ${price}`);
          continue;
        }

        // Find commodity
        const commodity = await Commodity.findOne({
          where: { external_id: item.id }
        });

        if (!commodity) {
          console.warn(`⚠️ Commodity not found for external_id: ${item.id} (${item.name})`);
          continue;
        }

        // Check for existing manual override
        const existingOverride = await Price.findOne({
          where: {
            commodity_id: commodity.id,
            date: today,
            is_override: true
          }
        });

        if (existingOverride) {
          console.log(`ℹ️ Skipping ${commodity.name} - manual override exists`);
          continue;
        }

        // Create or update price
        const [priceRecord, created] = await Price.findOrCreate({
          where: {
            commodity_id: commodity.id,
            date: today,
            source: 'api',
            level: levelHarga
          },
          defaults: {
            price: price,
            region_id: null,
            is_override: false
          }
        });

        if (!created && Math.abs(priceRecord.price - price) > 0.01) {
          const oldPrice = parseFloat(priceRecord.price);
          await priceRecord.update({ price: price });
          
          const changePercent = oldPrice > 0 ? Math.abs((price - oldPrice) / oldPrice * 100) : 0;
          console.log(`📈 Price updated for ${commodity.name}: ${oldPrice} → ${price} (${changePercent.toFixed(1)}%)`);
        }

        syncedPrices.push(priceRecord);

      } catch (error) {
        const errorMsg = `Error syncing price for ${item.name || 'unknown'}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`✅ Synced ${syncedPrices.length} prices, ${errors.length} errors`);
    if (errors.length > 0) {
      console.log('Sync errors:', errors.slice(0, 5)); // Show first 5 errors
    }
    
    return {
      synced: syncedPrices,
      errors: errors
    };
  }

  /**
   * Sync commodities dengan nama yang lebih fleksibel
   */
  async syncCommodities(apiData) {
    console.log('📦 Syncing commodities to database...');
    
    const syncedCommodities = [];
    
    for (const item of apiData) {
      try {
        if (!item.id) continue;

        const commodityName = item.name || `Komoditas ${item.id}`;
        
        const [commodity, created] = await Commodity.findOrCreate({
          where: { external_id: item.id },
          defaults: {
            external_id: item.id,
            name: commodityName,
            unit: item.satuan || 'Rp/kg',
            category: this.mapCommodityCategory(commodityName),
            image_url: item.background || null,
            is_active: true
          }
        });

        // Update existing commodity if data changed
        if (!created) {
          const updateData = {};
          if (item.name && item.name !== commodity.name) updateData.name = item.name;
          if (item.satuan && item.satuan !== commodity.unit) updateData.unit = item.satuan;
          if (item.background && item.background !== commodity.image_url) updateData.image_url = item.background;
          
          if (Object.keys(updateData).length > 0) {
            await commodity.update(updateData);
            console.log(`📝 Updated commodity: ${commodity.name}`);
          }
        }

        syncedCommodities.push(commodity);
      } catch (error) {
        console.error(`❌ Error syncing commodity ${item.name}:`, error.message);
      }
    }

    console.log(`✅ Synced ${syncedCommodities.length} commodities`);
    return syncedCommodities;
  }

  /**
   * Map commodity category based on name
   */
  mapCommodityCategory(name) {
    if (!name) return 'lainnya';
    
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('beras')) return 'beras';
    if (nameLower.includes('cabai') || nameLower.includes('bawang') || nameLower.includes('kemiri') || nameLower.includes('jahe')) return 'bumbu';
    if (nameLower.includes('sapi') || nameLower.includes('ayam') || nameLower.includes('telur') || nameLower.includes('daging') || nameLower.includes('ikan')) return 'daging';
    if (nameLower.includes('jagung') || nameLower.includes('kedelai') || nameLower.includes('kacang')) return 'sayuran';
    if (nameLower.includes('gula') || nameLower.includes('minyak') || nameLower.includes('tepung')) return 'lainnya';
    
    return 'lainnya';
  }

  /**
   * Full synchronization process dengan better error handling
   */
  async fullSync(options = {}) {
    const startTime = Date.now();
    
    console.log('🚀 Starting full BPN synchronization...');
    
    const results = {
      regions: 0,
      commodities: 0,
      prices: 0,
      price_errors: 0,
      duration: 0,
      errors: []
    };

    try {
      // Step 1: Fetch current prices
      const priceData = await this.fetchCurrentPrices(options);
      
      if (priceData && priceData.length > 0) {
        console.log(`Received ${priceData.length} items from BPN API`);
        
        // Step 2: Sync commodities
        try {
          const commodities = await this.syncCommodities(priceData);
          results.commodities = commodities.length;
        } catch (error) {
          results.errors.push(`Commodities: ${error.message}`);
        }

        // Step 3: Sync prices
        try {
          const levelHarga = options.levelHargaId === 1 ? 'produsen' : 
                           options.levelHargaId === 2 ? 'grosir' : 'konsumen';
          
          const priceSync = await this.syncPrices(priceData, levelHarga);
          results.prices = priceSync.synced.length;
          results.price_errors = priceSync.errors.length;
          
          if (priceSync.errors.length > 0) {
            results.errors.push(...priceSync.errors.slice(0, 3)); // Include some price errors
          }
        } catch (error) {
          results.errors.push(`Prices: ${error.message}`);
        }
      } else {
        results.errors.push('No price data received from BPN API');
      }

      results.duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      const successRate = results.commodities > 0 ? ((results.prices / results.commodities) * 100).toFixed(1) : 0;
      
      console.log(`✅ BPN sync completed in ${results.duration}s:`, {
        commodities: results.commodities,
        prices: results.prices,
        price_errors: results.price_errors,
        success_rate: `${successRate}%`,
        errors: results.errors.length
      });

      return {
        success: true,
        message: `Sync completed: ${results.commodities} commodities, ${results.prices} prices (${successRate}% success rate)`,
        data: results
      };

    } catch (error) {
      console.error('❌ Full sync failed:', error.message);
      
      return {
        success: false,
        message: `Sync failed: ${error.message}`,
        data: results
      };
    }
  }

  /**
   * Get latest prices dengan filter yang lebih baik
   */
  async getLatestPrices(options = {}) {
    const {
      date = new Date().toISOString().split('T')[0],
      limit = 50,
      category = null,
      search = null
    } = options;

    try {
      const whereClause = { 
        date: date,
        source: 'api'
      };

      const commodityWhere = { is_active: true };
      if (category) commodityWhere.category = category;
      if (search) {
        commodityWhere.name = { [require('sequelize').Op.like]: `%${search}%` };
      }

      const prices = await Price.findAll({
        where: whereClause,
        include: [{
          model: Commodity,
          where: commodityWhere,
          attributes: ['id', 'name', 'unit', 'category', 'image_url']
        }],
        limit: parseInt(limit),
        order: [['commodity_id', 'ASC']],
        attributes: ['id', 'commodity_id', 'price', 'date', 'level', 'source']
      });

      // Filter out zero prices untuk display
      const validPrices = prices.filter(price => parseFloat(price.price) > 0);

      return validPrices.map(price => ({
        id: price.id,
        commodity: price.Commodity,
        commodity_id: price.commodity_id,
        price: parseFloat(price.price),
        date: price.date,
        level: price.level,
        source: price.source
      }));

    } catch (error) {
      console.error('❌ Error fetching latest prices:', error.message);
      throw error;
    }
  }
}

module.exports = new BPNApiService();