// routes/imageProxy.js - NEW FILE
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Cache untuk gambar yang sudah didownload
const imageCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 jam

router.get('/bpn-image/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const originalUrl = `https://panelharga.badanpangan.go.id/assets/img/komoditas-ikon/${filename}`;
    
    // Check cache first
    const cached = imageCache.get(filename);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      res.set({
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      });
      return res.send(cached.data);
    }

    console.log(`📷 Proxying BPN image: ${originalUrl}`);

    // Download gambar dari BPN
    const response = await axios.get(originalUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://panelharga.badanpangan.go.id/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });

    const contentType = response.headers['content-type'] || 'image/png';
    
    // Cache the image
    imageCache.set(filename, {
      data: response.data,
      contentType,
      timestamp: Date.now()
    });

    // Set response headers
    res.set({
      'Content-Type': contentType,
      'Content-Length': response.data.length,
      'Cache-Control': 'public, max-age=86400', // Cache 1 hari
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });

    res.send(response.data);

  } catch (error) {
    console.error(`❌ Error proxying BPN image ${req.params.filename}:`, error.message);
    
    // Return placeholder image atau 404
    res.status(404).json({
      success: false,
      message: 'Image not found',
      error: error.message
    });
  }
});

// Endpoint untuk test semua gambar BPN yang tersedia
router.get('/bpn-images/test-all', async (req, res) => {
  const testImages = [
    'beras-premium.png',
    'beras-medium.png', 
    'cabai-merah-keriting.png',
    'bawang-merah.png',
    'daging-sapi-murni.png'
  ];

  const results = [];
  
  for (const filename of testImages) {
    try {
      const originalUrl = `https://panelharga.badanpangan.go.id/assets/img/komoditas-ikon/${filename}`;
      const response = await axios.head(originalUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://panelharga.badanpangan.go.id/'
        }
      });
      
      results.push({
        filename,
        original_url: originalUrl,
        proxy_url: `/api/images/bpn-image/${filename}`,
        status: 'OK',
        content_type: response.headers['content-type'],
        size: response.headers['content-length']
      });
    } catch (error) {
      results.push({
        filename,
        status: 'ERROR',
        error: error.message
      });
    }
  }

  res.json({
    success: true,
    tested_images: results.length,
    results
  });
});

module.exports = router;