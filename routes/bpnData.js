// ==========================================
// routes/bpnData.js - FIXED dengan menggunakan bpnApiService yang sudah ada
// ==========================================
const express = require('express');
const router = express.Router();
const bpnApiService = require('../services/bpnApiService');

// Cache untuk data BPN
let bpnCache = {
  data: null,
  timestamp: null,
  expiry: 30 * 60 * 1000 // 30 menit
};

// GET /api/bpn/prices - Get BPN price data using existing service
router.get('/prices', async (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (bpnCache.data && bpnCache.timestamp && (now - bpnCache.timestamp) < bpnCache.expiry) {
      console.log('📊 Serving BPN data from cache');
      return res.json({
        success: true,
        source: 'cache',
        cached_at: new Date(bpnCache.timestamp).toISOString(),
        data: bpnCache.data,
        count: bpnCache.data.length
      });
    }

    console.log('🔄 Fetching fresh BPN data using service...');
    
    // Gunakan service yang sudah ada
    const bpnData = await bpnApiService.fetchCurrentPrices({
      provinceId: '',
      cityId: '',
      levelHargaId: 3 // konsumen
    });

    // Update cache
    bpnCache = {
      data: bpnData,
      timestamp: now,
      expiry: 30 * 60 * 1000
    };

    res.json({
      success: true,
      source: 'fresh',
      fetched_at: new Date(now).toISOString(),
      data: bpnData,
      count: bpnData.length,
      message: `Retrieved ${bpnData.length} items from BPN API`
    });

  } catch (error) {
    console.error('BPN API Error:', error);
    
    // Return cached data if available
    if (bpnCache.data) {
      return res.json({
        success: true,
        source: 'cache_fallback',
        warning: 'Using cached data due to API error',
        cached_at: new Date(bpnCache.timestamp).toISOString(),
        data: bpnCache.data,
        count: bpnCache.data.length
      });
    }

    res.status(503).json({
      success: false,
      message: 'Gagal mengambil data dari Badan Pangan Nasional',
      error: error.message,
      retry_after: '5 minutes'
    });
  }
});

// GET /api/bpn/comparison - Get comparison data
router.get('/comparison', async (req, res) => {
  try {
    const SembakoPrice = require('../models/SembakoPrice');
    
    // Get internal average prices
    const internalStats = await SembakoPrice.findAll({
      attributes: [
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col('harga_beras')), 'avg_beras'],
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col('harga_gula')), 'avg_gula'],
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col('harga_minyak')), 'avg_minyak'],
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col('harga_daging')), 'avg_daging'],
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col('harga_ayam')), 'avg_ayam'],
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col('harga_telur')), 'avg_telur'],
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col('harga_bawang_merah')), 'avg_bawang_merah'],
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col('harga_bawang_putih')), 'avg_bawang_putih'],
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col('harga_garam')), 'avg_garam'],
      ],
      raw: true
    });

    // Get BPN data (use cache if available, otherwise fetch fresh)
    let bpnData;
    const now = Date.now();
    if (bpnCache.data && bpnCache.timestamp && (now - bpnCache.timestamp) < bpnCache.expiry) {
      bpnData = bpnCache.data;
    } else {
      bpnData = await bpnApiService.fetchCurrentPrices({
        levelHargaId: 3
      });
      bpnCache = { data: bpnData, timestamp: now, expiry: 30 * 60 * 1000 };
    }
    
    // Generate comparison
    const comparison = generateComparison(internalStats[0], bpnData);

    res.json({
      success: true,
      message: "Comparison data between internal and BPN",
      data: {
        internal_averages: internalStats[0],
        bpn_data: bpnData,
        comparison: comparison,
        summary: {
          total_comparisons: comparison.length,
          higher_than_bpn: comparison.filter(c => c.trend === 'higher').length,
          lower_than_bpn: comparison.filter(c => c.trend === 'lower').length,
          same_as_bpn: comparison.filter(c => c.trend === 'same').length
        },
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Comparison API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal membuat perbandingan data',
      error: error.message
    });
  }
});

// Function to generate comparison - disesuaikan dengan format data dari bpnApiService
const generateComparison = (internalData, bpnData) => {
  // Mapping berdasarkan struktur data yang sebenarnya dari BPN API
  const mapping = {
    // Format nama bisa berbeda dari API BPN yang sebenarnya
    'Beras Premium': { key: 'avg_beras', name: 'Beras', priority: 1 },
    'Beras Medium': { key: 'avg_beras', name: 'Beras', priority: 2 },
    'Beras Kualitas Super I': { key: 'avg_beras', name: 'Beras', priority: 1 },
    'Gula Pasir Lokal': { key: 'avg_gula', name: 'Gula', priority: 1 },
    'Gula Pasir Kualitas Premium': { key: 'avg_gula', name: 'Gula', priority: 2 },
    'Minyak Goreng Curah': { key: 'avg_minyak', name: 'Minyak Goreng', priority: 1 },
    'Minyak Goreng Kemasan Bermerk': { key: 'avg_minyak', name: 'Minyak Goreng', priority: 2 },
    'Daging Sapi Kualitas I': { key: 'avg_daging', name: 'Daging Sapi', priority: 1 },
    'Daging Ayam Ras Segar': { key: 'avg_ayam', name: 'Daging Ayam', priority: 1 },
    'Telur Ayam Ras Segar': { key: 'avg_telur', name: 'Telur Ayam', priority: 1 },
    'Bawang Merah Ukuran Sedang': { key: 'avg_bawang_merah', name: 'Bawang Merah', priority: 1 },
    'Bawang Putih Ukuran Sedang': { key: 'avg_bawang_putih', name: 'Bawang Putih', priority: 1 },
    'Garam Beryodium': { key: 'avg_garam', name: 'Garam', priority: 1 }
  };

  const comparison = [];
  const processedKeys = new Set();
  
  // Sort BPN data by priority to get main commodities first
  const sortedBpnData = bpnData.sort((a, b) => {
    const aPriority = mapping[a.name]?.priority || 999;
    const bPriority = mapping[b.name]?.priority || 999;
    return aPriority - bPriority;
  });

  sortedBpnData.forEach(bpnItem => {
    const mapped = mapping[bpnItem.name];
    if (mapped && internalData[mapped.key] && !processedKeys.has(mapped.key)) {
      const internalPrice = parseFloat(internalData[mapped.key]);
      const bpnPrice = bpnItem.today || bpnItem.price || 0; // fallback untuk berbagai format
      
      if (bpnPrice > 0) {
        const difference = internalPrice - bpnPrice;
        const percentageDiff = ((difference / bpnPrice) * 100);

        comparison.push({
          commodity_name: mapped.name,
          bpn_name: bpnItem.name,
          internal_price: internalPrice,
          bpn_price: bpnPrice,
          difference: difference,
          percentage_difference: percentageDiff,
          trend: Math.abs(difference) < 500 ? 'same' : (difference > 0 ? 'higher' : 'lower'),
          bpn_trend: bpnItem.gap_change || 'stable',
          bpn_gap: bpnItem.gap || 0,
          bpn_gap_percentage: bpnItem.gap_percentage || 0,
          unit: bpnItem.unit || bpnItem.satuan || 'Rp/kg',
          bpn_id: bpnItem.id,
          image_url: bpnItem.image_url || bpnItem.background,
          yesterday_date: bpnItem.yesterday_date || new Date().toISOString().split('T')[0]
        });

        processedKeys.add(mapped.key);
      }
    }
  });

  return comparison;
};

// GET /api/bpn/latest - Get latest prices using existing service
router.get('/latest', async (req, res) => {
  try {
    const { limit = 20, category, search } = req.query;
    
    const latestPrices = await bpnApiService.getLatestPrices({
      limit: parseInt(limit),
      category,
      search
    });

    res.json({
      success: true,
      message: `Retrieved ${latestPrices.length} latest prices`,
      data: latestPrices,
      count: latestPrices.length
    });

  } catch (error) {
    console.error('Latest prices error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data harga terbaru',
      error: error.message
    });
  }
});

// GET /api/bpn/sync - Manual sync using existing service
router.post('/sync', async (req, res) => {
  try {
    const { provinceId, cityId, levelHargaId = 3 } = req.body;
    
    const syncResult = await bpnApiService.fullSync({
      provinceId,
      cityId,
      levelHargaId: parseInt(levelHargaId)
    });

    res.json({
      success: syncResult.success,
      message: syncResult.message,
      data: syncResult.data
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal melakukan sinkronisasi',
      error: error.message
    });
  }
});

// GET /api/bpn/trends - Get trend analysis
router.get('/trends', async (req, res) => {
  try {
    // Get BPN data (use cache if available)
    let bpnData;
    const now = Date.now();
    if (bpnCache.data && bpnCache.timestamp && (now - bpnCache.timestamp) < bpnCache.expiry) {
      bpnData = bpnCache.data;
    } else {
      bpnData = await bpnApiService.fetchCurrentPrices({ levelHargaId: 3 });
      bpnCache = { data: bpnData, timestamp: now, expiry: 30 * 60 * 1000 };
    }
    
    const trends = {
      increasing: bpnData.filter(item => (item.gap_change === 'up' || item.gap > 0)).length,
      decreasing: bpnData.filter(item => (item.gap_change === 'down' || item.gap < 0)).length,
      stable: bpnData.filter(item => Math.abs(item.gap || 0) < 50).length,
      total_commodities: bpnData.length,
      average_change: bpnData.reduce((sum, item) => sum + (item.gap_percentage || 0), 0) / bpnData.length,
      highest_increase: bpnData.reduce((max, item) => 
        ((item.gap_percentage || 0) > (max.gap_percentage || -Infinity)) ? item : max, 
        {}
      ),
      highest_decrease: bpnData.reduce((min, item) => 
        ((item.gap_percentage || 0) < (min.gap_percentage || Infinity)) ? item : min, 
        {}
      ),
      price_ranges: {
        under_10k: bpnData.filter(item => (item.today || item.price || 0) < 10000).length,
        between_10k_50k: bpnData.filter(item => {
          const price = item.today || item.price || 0;
          return price >= 10000 && price < 50000;
        }).length,
        above_50k: bpnData.filter(item => (item.today || item.price || 0) >= 50000).length
      }
    };

    res.json({
      success: true,
      message: "BPN trends analysis",
      data: trends,
      meta: {
        last_update: new Date().toISOString(),
        source: 'Badan Pangan Nasional',
        analysis_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Trends API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menganalisis trend BPN',
      error: error.message
    });
  }
});

// GET /api/bpn/cache/status - Check cache status
router.get('/cache/status', (req, res) => {
  const now = Date.now();
  const isExpired = !bpnCache.timestamp || (now - bpnCache.timestamp) > bpnCache.expiry;
  const timeLeft = bpnCache.timestamp ? Math.max(0, bpnCache.expiry - (now - bpnCache.timestamp)) : 0;

  res.json({
    success: true,
    cache: {
      has_data: !!bpnCache.data,
      timestamp: bpnCache.timestamp ? new Date(bpnCache.timestamp).toISOString() : null,
      is_expired: isExpired,
      time_left_ms: timeLeft,
      time_left_minutes: Math.round(timeLeft / (1000 * 60)),
      expiry_minutes: bpnCache.expiry / (1000 * 60),
      data_size: bpnCache.data ? JSON.stringify(bpnCache.data).length : 0,
      records_count: bpnCache.data?.length || 0
    }
  });
});

// POST /api/bpn/cache/clear - Clear cache
router.post('/cache/clear', (req, res) => {
  const oldCacheSize = bpnCache.data ? JSON.stringify(bpnCache.data).length : 0;
  
  bpnCache = {
    data: null,
    timestamp: null,
    expiry: 30 * 60 * 1000
  };

  res.json({
    success: true,
    message: 'BPN cache cleared successfully',
    cleared: {
      data_size: oldCacheSize,
      cleared_at: new Date().toISOString()
    }
  });
});

// GET /api/bpn/health - Health check for BPN service
router.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test connectivity using existing service
    await bpnApiService.fetchCurrentPrices({ 
      provinceId: '',
      cityId: '',
      levelHargaId: 3 
    });
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      status: 'healthy',
      response_time_ms: responseTime,
      cache_status: {
        has_cached_data: !!bpnCache.data,
        cache_age_minutes: bpnCache.timestamp ? Math.round((Date.now() - bpnCache.timestamp) / (1000 * 60)) : null
      },
      checked_at: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      cache_fallback_available: !!bpnCache.data,
      checked_at: new Date().toISOString()
    });
  }
});

// GET /api/bpn/commodities - Get list of available commodities
router.get('/commodities', async (req, res) => {
  try {
    // Get BPN data (use cache if available)
    let bpnData;
    const now = Date.now();
    if (bpnCache.data && bpnCache.timestamp && (now - bpnCache.timestamp) < bpnCache.expiry) {
      bpnData = bpnCache.data;
    } else {
      bpnData = await bpnApiService.fetchCurrentPrices({ levelHargaId: 3 });
      bpnCache = { data: bpnData, timestamp: now, expiry: 30 * 60 * 1000 };
    }

    const commodities = bpnData.map(item => ({
      id: item.id,
      name: item.name,
      unit: item.unit || item.satuan || 'Rp/kg',
      current_price: item.today || item.price || 0,
      has_image: !!(item.image_url || item.background),
      image_url: item.image_url || item.background,
      trend: item.gap_change || 'stable',
      change_amount: item.gap || 0,
      change_percentage: item.gap_percentage || 0
    }));

    res.json({
      success: true,
      message: "BPN commodities list",
      data: {
        all_commodities: commodities,
        summary: {
          total: commodities.length,
          with_images: commodities.filter(c => c.has_image).length,
        }
      }
    });

  } catch (error) {
    console.error('Commodities API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar komoditas',
      error: error.message
    });
  }
});

module.exports = router;