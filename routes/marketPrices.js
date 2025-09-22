// routes/marketPrices.js
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
} = require("../controllers/marketPricesController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const MarketPrice = require("../models/MarketPrice");

const router = express.Router();

// Konfigurasi upload gambar & CSV
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
    cb(null, Date.now() + "-" + cleanFilename);
  },
});
const upload = multer({ storage });

// ✅ CRUD routes
router.get("/", authenticateToken, getAll);
router.get("/statistics", authenticateToken, getStatistics);
router.get("/:id", authenticateToken, getById);

// ✅ Admin & Editor bisa create
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "editor"),
  upload.single("image"),
  create
);

// ✅ Hanya admin yang bisa update & delete
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  upload.single("image"),
  update
);
router.delete("/:id", authenticateToken, authorizeRoles("admin"), remove);

// ✅ Statistik harga per provinsi (langsung ambil dari market_prices)
router.get("/statistics/province", authenticateToken, async (req, res) => {
  try {
    const result = await MarketPrice.findAll({
      attributes: [
        "province_name",
        [
          MarketPrice.sequelize.fn("AVG", MarketPrice.sequelize.col("price")),
          "avg_price",
        ],
        [
          MarketPrice.sequelize.fn("COUNT", MarketPrice.sequelize.col("id")),
          "total_products",
        ],
      ],
      group: ["province_name"],
      raw: true,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Gagal ambil data" });
  }
});

// ✅ Search produk/pasar/provinsi
router.get("/search", authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });

    const result = await MarketPrice.findAll({
      where: {
        [MarketPrice.sequelize.Op.or]: [
          { product_name: { [MarketPrice.sequelize.Op.like]: `%${q}%` } },
          { market_name: { [MarketPrice.sequelize.Op.like]: `%${q}%` } },
          { province_name: { [MarketPrice.sequelize.Op.like]: `%${q}%` } },
        ],
      },
      limit: 50,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Gagal cari data" });
  }
});

// ✅ Import CSV
router.post(
  "/import",
  authenticateToken,
  authorizeRoles("admin","editor"),
  upload.single("file"),
  importCSV
);

module.exports = router;
