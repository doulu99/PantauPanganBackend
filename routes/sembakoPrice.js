// routes/sembakoPrice.js
const express = require("express");
const multer = require("multer");
const {
  getAll,
  getById,
  create,
  update,
  remove,
  importCSV,
  getStatistics,
  getLatestPrices,
} = require("../controllers/sembakoPriceController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const SembakoPrice = require("../models/SembakoPrice");

const router = express.Router();

// Konfigurasi upload CSV
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "public/uploads";
    const fs = require("fs");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `sembako-${Date.now()}-${cleanFilename}`);
  },
});

// Filter hanya CSV files
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file CSV yang diizinkan'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ✅ PUBLIC Routes (tidak perlu login)
router.get("/public/latest", getLatestPrices);
router.get("/public/statistics", getStatistics);

// ✅ CRUD routes (perlu authentication)
router.get("/", authenticateToken, getAll);
router.get("/statistics", authenticateToken, getStatistics);
router.get("/latest", authenticateToken, getLatestPrices);
router.get("/:id", authenticateToken, getById);

// ✅ Admin & Editor bisa create
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "editor"),
  create
);

// ✅ Admin & Editor bisa update
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "editor"),
  update
);

// ✅ Hanya admin yang bisa delete
router.delete("/:id", authenticateToken, authorizeRoles("admin"), remove);

// ✅ Import CSV - Admin & Editor
router.post(
  "/import",
  authenticateToken,
  authorizeRoles("admin", "editor"),
  upload.single("file"),
  importCSV
);

// ✅ Bulk operations
router.post("/bulk/delete", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "IDs array diperlukan"
      });
    }

    const deletedCount = await SembakoPrice.destroy({
      where: {
        id: ids
      }
    });

    res.json({
      success: true,
      message: `${deletedCount} data berhasil dihapus`,
      data: { deleted_count: deletedCount }
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal menghapus data",
      error: error.message
    });
  }
});

// ✅ Search & Filter khusus
router.get("/search/province", authenticateToken, async (req, res) => {
  try {
    const provinces = await SembakoPrice.findAll({
      attributes: ['province_name'],
      group: ['province_name'],
      order: [['province_name', 'ASC']]
    });

    res.json({
      success: true,
      data: provinces.map(p => p.province_name)
    });
  } catch (error) {
    console.error("Search province error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar provinsi",
      error: error.message
    });
  }
});

router.get("/search/markets", authenticateToken, async (req, res) => {
  try {
    const { province } = req.query;
    let whereClause = {};
    
    if (province) {
      whereClause.province_name = { [SembakoPrice.sequelize.Op.like]: `%${province}%` };
    }

    const markets = await SembakoPrice.findAll({
      attributes: ['market_name', 'province_name'],
      where: whereClause,
      group: ['market_name', 'province_name'],
      order: [['market_name', 'ASC']]
    });

    res.json({
      success: true,
      data: markets.map(m => ({
        market_name: m.market_name,
        province_name: m.province_name
      }))
    });
  } catch (error) {
    console.error("Search markets error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar pasar",
      error: error.message
    });
  }
});

// ✅ Export data ke CSV
router.get("/export/csv", authenticateToken, async (req, res) => {
  try {
    const { province_name, start_date, end_date } = req.query;
    
    let whereClause = { status: 'published' };
    if (province_name) {
      whereClause.province_name = { [SembakoPrice.sequelize.Op.like]: `%${province_name}%` };
    }
    if (start_date && end_date) {
      whereClause.survey_date = {
        [SembakoPrice.sequelize.Op.between]: [start_date, end_date]
      };
    }

    const data = await SembakoPrice.findAll({
      where: whereClause,
      order: [['survey_date', 'DESC']],
      limit: 1000 // Batasi untuk performance
    });

    // Convert to CSV format
    const csvHeader = 'Timestamp,Province ID,Nama Pasar,Tanggal,Harga Beras,Harga Gula,Harga Minyak,Harga Daging,Harga Ayam,Harga Telur,Harga Bawang Merah,Harga Bawang Putih,Harga Gas,Harga Garam,Harga Susu\n';
    
    const csvRows = data.map(row => [
      row.timestamp.toISOString(),
      row.province_name,
      row.market_name,
      row.survey_date,
      row.harga_beras || '',
      row.harga_gula || '',
      row.harga_minyak || '',
      row.harga_daging || '',
      row.harga_ayam || '',
      row.harga_telur || '',
      row.harga_bawang_merah || '',
      row.harga_bawang_putih || '',
      row.harga_gas || '',
      row.harga_garam || '',
      row.harga_susu || ''
    ].join(','));

    const csvContent = csvHeader + csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sembako-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error("Export CSV error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal export data",
      error: error.message
    });
  }
});

// ✅ Analisis trend harga per komoditas
router.get("/analysis/trends", authenticateToken, async (req, res) => {
  try {
    const { commodity, province, days = 30 } = req.query;
    
    const validCommodities = [
      'harga_beras', 'harga_gula', 'harga_minyak', 'harga_daging', 
      'harga_ayam', 'harga_telur', 'harga_bawang_merah', 
      'harga_bawang_putih', 'harga_gas', 'harga_garam', 'harga_susu'
    ];

    if (!commodity || !validCommodities.includes(commodity)) {
      return res.status(400).json({
        success: false,
        message: "Commodity parameter harus salah satu dari: " + validCommodities.join(', ')
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let whereClause = {
      survey_date: { [SembakoPrice.sequelize.Op.gte]: startDate },
      [commodity]: { [SembakoPrice.sequelize.Op.not]: null },
      status: 'published'
    };

    if (province) {
      whereClause.province_name = { [SembakoPrice.sequelize.Op.like]: `%${province}%` };
    }

    const trends = await SembakoPrice.findAll({
      attributes: [
        'survey_date',
        [SembakoPrice.sequelize.fn('AVG', SembakoPrice.sequelize.col(commodity)), 'avg_price'],
        [SembakoPrice.sequelize.fn('MIN', SembakoPrice.sequelize.col(commodity)), 'min_price'],
        [SembakoPrice.sequelize.fn('MAX', SembakoPrice.sequelize.col(commodity)), 'max_price'],
        [SembakoPrice.sequelize.fn('COUNT', SembakoPrice.sequelize.col(commodity)), 'data_points']
      ],
      where: whereClause,
      group: ['survey_date'],
      order: [['survey_date', 'ASC']]
    });

    res.json({
      success: true,
      message: "Analisis trend berhasil diambil",
      data: {
        commodity,
        province: province || 'Semua Provinsi',
        period_days: parseInt(days),
        trends: trends.map(t => ({
          date: t.survey_date,
          avg_price: parseFloat(t.dataValues.avg_price || 0).toFixed(0),
          min_price: parseFloat(t.dataValues.min_price || 0).toFixed(0),
          max_price: parseFloat(t.dataValues.max_price || 0).toFixed(0),
          data_points: parseInt(t.dataValues.data_points)
        }))
      }
    });

  } catch (error) {
    console.error("Trends analysis error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal analisis trend",
      error: error.message
    });
  }
});

module.exports = router;