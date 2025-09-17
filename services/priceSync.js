// services/priceSync.js - Improved version with retry and better error handling
const axios = require('axios');
const { Commodity, Price, Region, AuditLog } = require('../models');
const { Op } = require('sequelize');

// Create axios instance with custom config
const axiosInstance = axios.create({
  timeout: 60000, // 60 seconds timeout
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
});

// Add request interceptor for logging
axiosInstance.interceptors.request.use(request => {
  console.log(`📡 Starting Request: ${request.method?.toUpperCase()} ${request.url}`);
  return request;
});

// Add response interceptor for error handling
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Request timeout');
    } else if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      console.error('❌ Connection error:', error.code);
    } else {
      console.error('❌ Request failed:', error.message);
    }
    return Promise.reject(error);
  }
);

// Retry logic wrapper
async function retryRequest(fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`⚠️ Attempt ${i + 1} failed: ${error.message}`);
      
      if (i === retries - 1) {
        throw error;
      }
      
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff
      delay *= 2;
    }
  }
}

// API Endpoints
const API_BASE = 'https://api-panelhargav2.badanpangan.go.id/api';
const ENDPOINTS = {
  HARGA_INFORMASI: `${API_BASE}/front/harga-pangan-informasi`,
  HARGA_PETA_PROVINSI: `${API_BASE}/front/harga-peta-provinsi`,
  PROVINCES: `${API_BASE}/provinces`,
  CITIES: `${API_BASE}/cities`
};

/**
 * Fetch general price information with retry
 */
const fetchHargaInformasi = async (provinceId = '', cityId = '', levelHargaId = 3) => {
  return retryRequest(async () => {
    const url = `${ENDPOINTS.HARGA_INFORMASI}?province_id=${provinceId}&city_id=${cityId}&level_harga_id=${levelHargaId}`;
    
    const response = await axiosInstance.get(url);
    
    if (response.data && response.data.status === 'success') {
      return response.data;
    } else {
      throw new Error(`API returned error: ${response.data?.message || 'Unknown error'}`);
    }
  });
};

/**
 * Fetch price map data by province with retry
 */
const fetchHargaPetaProvinsi = async (levelHargaId = 3, komoditasId = 109, periodDate = null) => {
  return retryRequest(async () => {
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}%2F${(today.getMonth() + 1).toString().padStart(2, '0')}%2F${today.getFullYear()}`;
    const period = periodDate || `${dateStr}%20-%20${dateStr}`;
    
    const url = `${ENDPOINTS.HARGA_PETA_PROVINSI}?level_harga_id=${levelHargaId}&komoditas_id=${komoditasId}&period_date=${period}&multi_status_map[0]=&multi_province_id[0]=`;
    
    const response = await axiosInstance.get(url);
    
    if (response.data && response.data.status === 'success') {
      return response.data;
    } else {
      throw new Error(`API returned error: ${response.data?.message || 'Unknown error'}`);
    }
  });
};

/**
 * Fetch provinces list with retry
 */
const fetchProvinces = async (search = '') => {
  return retryRequest(async () => {
    const url = `${ENDPOINTS.PROVINCES}?search=${search}`;
    
    const response = await axiosInstance.get(url);
    
    if (response.data && response.data.status === 'success') {
      return response.data.data;
    } else {
      throw new Error(`API returned error: ${response.data?.message || 'Unknown error'}`);
    }
  }, 2, 1000); // Less retries for provinces
};

/**
 * Fetch cities list by province
 */
const fetchCities = async (provinceId) => {
  return retryRequest(async () => {
    const url = `${ENDPOINTS.CITIES}?province_id=${provinceId}`;
    
    const response = await axiosInstance.get(url);
    
    if (response.data && response.data.status === 'success') {
      return response.data.data;
    } else {
      throw new Error(`API returned error: ${response.data?.message || 'Unknown error'}`);
    }
  }, 2, 1000);
};

/**
 * Map commodity category based on name
 */
const getCommodityCategory = (name) => {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('beras') || nameLower.includes('gkp') || nameLower.includes('gkg')) {
    return 'beras';
  } else if (nameLower.includes('cabai') || nameLower.includes('bawang')) {
    return 'bumbu';
  } else if (nameLower.includes('sapi') || nameLower.includes('ayam') || nameLower.includes('telur') || nameLower.includes('daging') || nameLower.includes('kerbau')) {
    return 'daging';
  } else if (nameLower.includes('ikan') || nameLower.includes('tongkol') || nameLower.includes('kembung') || nameLower.includes('bandeng')) {
    return 'daging';
  } else if (nameLower.includes('jagung') || nameLower.includes('kedelai')) {
    return 'sayuran';
  } else if (nameLower.includes('gula') || nameLower.includes('garam') || nameLower.includes('minyak') || nameLower.includes('tepung')) {
    return 'lainnya';
  } else {
    return 'lainnya';
  }
};

/**
 * Sync provinces and cities to database
 */
const syncRegions = async () => {
  try {
    console.log('🔄 Syncing provinces...');
    const provinces = await fetchProvinces();
    
    if (!provinces || provinces.length === 0) {
      console.warn('⚠️ No provinces data received');
      return 0;
    }
    
    let syncedCount = 0;
    
    for (const province of provinces) {
      try {
        const [region, created] = await Region.findOrCreate({
          where: { 
            province_id: province.id,
            level: 'province'
          },
          defaults: {
            province_id: province.id,
            province_name: province.nama || province.name,
            city_id: null,
            city_name: null,
            level: 'province'
          }
        });
        
        if (created) syncedCount++;
      } catch (error) {
        console.error(`Error syncing province ${province.nama}:`, error.message);
      }
    }
    
    console.log(`✅ Synced ${syncedCount} new provinces (${provinces.length} total)`);
    return provinces.length;
  } catch (error) {
    console.error('Error syncing regions:', error.message);
    return 0;
  }
};

/**
 * Sync commodities from API data
 */
const syncCommodities = async (apiData) => {
  const commodities = [];
  
  if (!apiData || !Array.isArray(apiData)) {
    console.warn('⚠️ No commodity data to sync');
    return commodities;
  }
  
  for (const item of apiData) {
    try {
      // Skip if no id
      if (!item.id) continue;
      
      // Find or create commodity
      const [commodity, created] = await Commodity.findOrCreate({
        where: { external_id: item.id },
        defaults: {
          external_id: item.id,
          name: item.name || item.nama || `Commodity ${item.id}`,
          unit: item.satuan || 'Rp/kg',
          category: getCommodityCategory(item.name || item.nama || ''),
          image_url: item.background || null,
          is_active: true
        }
      });

      // Update if exists and has changes
      if (!created && (item.name || item.nama)) {
        await commodity.update({
          name: item.name || item.nama,
          unit: item.satuan || commodity.unit,
          image_url: item.background || commodity.image_url
        });
      }

      commodities.push(commodity);
    } catch (error) {
      console.error(`Error syncing commodity ${item.name || item.nama || item.id}:`, error.message);
    }
  }
  
  console.log(`📦 Processed ${commodities.length} commodities`);
  return commodities;
};

/**
 * Save prices to database from harga informasi endpoint
 */
const savePricesFromInformasi = async (apiData, regionId = null, levelHarga = 'konsumen') => {
  const today = new Date().toISOString().split('T')[0];
  const savedPrices = [];
  
  if (!apiData || !Array.isArray(apiData)) {
    console.warn('⚠️ No price data to save');
    return savedPrices;
  }
  
  for (const item of apiData) {
    try {
      // Skip if no id or price
      if (!item.id || (!item.today && item.today !== 0)) continue;
      
      // Get commodity
      const commodity = await Commodity.findOne({ 
        where: { external_id: item.id } 
      });
      
      if (!commodity) {
        console.warn(`⚠️ Commodity not found for external_id: ${item.id} (${item.name})`);
        continue;
      }

      // Check if there's already a manual override for today
      const existingPrice = await Price.findOne({
        where: {
          commodity_id: commodity.id,
          date: today,
          region_id: regionId,
          is_override: true
        }
      });

      // Skip if there's an active manual override
      if (existingPrice) {
        console.log(`ℹ️ Skipping ${commodity.name} - manual override exists`);
        continue;
      }

      // Save or update price
      const [price, created] = await Price.findOrCreate({
        where: {
          commodity_id: commodity.id,
          date: today,
          region_id: regionId,
          source: 'api',
          level: levelHarga
        },
        defaults: {
          price: item.today,
          is_override: false
        }
      });

      // Update price if changed
      if (!created && price.price != item.today) {
        const oldPrice = price.price;
        await price.update({ price: item.today });
        
        // Log significant price changes (> 5%)
        const changePercent = Math.abs((item.today - oldPrice) / oldPrice * 100);
        if (changePercent > 5) {
          console.log(`📈 Price updated for ${commodity.name}: ${oldPrice} → ${item.today} (${changePercent.toFixed(1)}% change)`);
        }
      }

      savedPrices.push(price);
    } catch (error) {
      console.error(`Error saving price for ${item.name || item.id}:`, error.message);
    }
  }
  
  console.log(`💾 Saved ${savedPrices.length} prices`);
  return savedPrices;
};

/**
 * Main sync function with multiple data sources
 */
const syncPricesFromAPI = async (options = {}) => {
  const {
    provinceId = '',
    cityId = '',
    levelHargaId = 3, // Default konsumen
    includeProvinceMap = false,
    komoditasIds = [109], // Default Beras SPHP
    syncRegions: shouldSyncRegions = true
  } = options;
  
  const startTime = Date.now();
  
  try {
    console.log('🔄 Starting comprehensive price synchronization...');
    console.log('   Options:', { levelHargaId, includeProvinceMap, komoditasIds });
    
    const results = {
      regions: 0,
      commodities: 0,
      prices: 0,
      provinceMapPrices: 0,
      errors: []
    };
    
    // Step 1: Sync regions (if enabled)
    if (shouldSyncRegions) {
      try {
        results.regions = await syncRegions();
      } catch (error) {
        console.warn('⚠️ Region sync failed (non-critical):', error.message);
        results.errors.push(`Region sync: ${error.message}`);
      }
    }
    
    // Add delay between API calls to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Fetch and sync general price information
    try {
      console.log('📊 Fetching price information...');
      const hargaInfo = await fetchHargaInformasi(provinceId, cityId, levelHargaId);
      
      if (hargaInfo && hargaInfo.data && hargaInfo.data.length > 0) {
        console.log(`✅ Received ${hargaInfo.data.length} items from API`);
        
        // Sync commodities
        const commodities = await syncCommodities(hargaInfo.data);
        results.commodities = commodities.length;
        
        // Determine level
        const level = levelHargaId === 1 ? 'produsen' : levelHargaId === 2 ? 'grosir' : 'konsumen';
        
        // Save prices
        const prices = await savePricesFromInformasi(hargaInfo.data, null, level);
        results.prices = prices.length;
      } else {
        console.warn('⚠️ No price data received from API');
      }
    } catch (error) {
      console.error('❌ Price information sync failed:', error.message);
      results.errors.push(`Price sync: ${error.message}`);
    }
    
    // Step 3: Fetch province-level prices if requested
    if (includeProvinceMap) {
      for (const komoditasId of komoditasIds) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1500)); // Delay between requests
          
          console.log(`📍 Fetching province prices for commodity ${komoditasId}...`);
          const petaData = await fetchHargaPetaProvinsi(levelHargaId, komoditasId);
          
          if (petaData && petaData.data && petaData.data.length > 0) {
            console.log(`✅ Received ${petaData.data.length} province prices`);
            // Implementation for saving province data can be added here
            results.provinceMapPrices += petaData.data.length;
          }
        } catch (error) {
          console.error(`❌ Province map sync failed for commodity ${komoditasId}:`, error.message);
          results.errors.push(`Province map ${komoditasId}: ${error.message}`);
        }
      }
    }
    
    // Clean up old overrides (expired)
    try {
      const expiredOverrides = await Price.destroy({
        where: {
          is_override: true,
          updatedAt: {
            [Op.lt]: new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours
          }
        }
      });
      
      if (expiredOverrides > 0) {
        console.log(`🗑️ Cleaned up ${expiredOverrides} expired overrides`);
      }
      results.expiredOverrides = expiredOverrides;
    } catch (error) {
      console.error('Error cleaning expired overrides:', error.message);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Synchronization completed in ${duration}s:`, {
      ...results,
      errors: results.errors.length
    });
    
    return {
      success: true,
      message: 'Synchronization completed',
      duration: `${duration}s`,
      stats: results
    };
  } catch (error) {
    console.error('❌ Sync failed:', error);
    
    // Log error
    try {
      await AuditLog.create({
        action: 'sync_error',
        entity_type: 'system',
        entity_id: 0,
        new_values: { error: error.message }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError.message);
    }
    
    throw error;
  }
};

/**
 * Get price comparison (API vs Manual)
 */
const getPriceComparison = async (date = new Date()) => {
  const dateStr = date.toISOString().split('T')[0];
  
  const prices = await Price.findAll({
    where: { date: dateStr },
    include: [{
      model: Commodity,
      attributes: ['id', 'name', 'unit', 'category']
    }],
    order: [['commodity_id', 'ASC']]
  });
  
  const comparison = {};
  
  for (const price of prices) {
    const commodityId = price.commodity_id;
    
    if (!comparison[commodityId]) {
      comparison[commodityId] = {
        commodity: price.Commodity,
        api_price: null,
        manual_price: null,
        active_price: null,
        difference: null,
        difference_percentage: null
      };
    }
    
    if (price.source === 'api') {
      comparison[commodityId].api_price = price.price;
    } else {
      comparison[commodityId].manual_price = price.price;
    }
    
    // Determine active price (manual overrides API)
    if (price.is_override) {
      comparison[commodityId].active_price = price.price;
    } else if (!comparison[commodityId].manual_price) {
      comparison[commodityId].active_price = price.price;
    }
  }
  
  // Calculate differences
  Object.values(comparison).forEach(item => {
    if (item.api_price && item.manual_price) {
      item.difference = item.manual_price - item.api_price;
      item.difference_percentage = ((item.difference / item.api_price) * 100).toFixed(2);
    }
  });
  
  return Object.values(comparison);
};

module.exports = {
  fetchHargaInformasi,
  fetchHargaPetaProvinsi,
  fetchProvinces,
  fetchCities,
  syncPricesFromAPI,
  syncCommodities,
  savePricesFromInformasi,
  syncRegions,
  getPriceComparison
};