// controllers/marketPricesController.js
const MarketPrice = require("../models/MarketPrice");
const Region = require("../models/Region");
const csv = require("csv-parser");
const fs = require("fs");
const { Op, fn, col } = require("sequelize");

const marketPriceController = {
  // ✅ GET ALL
  getAll: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        market_type,
        market_name,
        province_id,
        status,
        reported_by,
      } = req.query;

      const whereClause = {};
      if (search) whereClause.product_name = { [Op.like]: `%${search}%` };
      if (market_type) whereClause.market_type = market_type;
      if (market_name) whereClause.market_name = { [Op.like]: `%${market_name}%` };
      if (province_id) whereClause.province_id = province_id;
      if (status) whereClause.status = status;
      if (reported_by) whereClause.reported_by = reported_by;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows } = await MarketPrice.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: Region,
            as: "province",
            attributes: ["province_id", "province_name"],
            required: false,
          },
        ],
      });

      res.json({
        success: true,
        message: "Data berhasil diambil",
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit)),
        },
      });
    } catch (err) {
      console.error("Error getAll:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Gagal mengambil data harga pangan",
          error: err.message,
        });
    }
  },

  // ✅ GET BY ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const price = await MarketPrice.findByPk(id, {
        include: [
          {
            model: Region,
            as: "province",
            attributes: ["province_id", "province_name"],
            required: false,
          },
        ],
      });

      if (!price) {
        return res
          .status(404)
          .json({ success: false, message: "Data tidak ditemukan" });
      }

      res.json({
        success: true,
        message: "Data berhasil diambil",
        data: price,
      });
    } catch (err) {
      console.error("Error getById:", err);
      res
        .status(500)
        .json({ success: false, message: "Gagal mengambil data", error: err.message });
    }
  },

  // ✅ CREATE
  create: async (req, res) => {
    try {
      const {
        product_name,
        price,
        unit,
        market_type,
        market_name,
        province_id,
        grade,
        effective_date,
        source,
        created_by,
        reported_by,
        status,
      } = req.body;

      if (!product_name || !price || !market_type) {
        return res.status(400).json({
          success: false,
          message: "Nama produk, harga, dan tipe pasar wajib diisi",
        });
      }

      const image_url = req.file ? `/uploads/${req.file.filename}` : null;

      const newPrice = await MarketPrice.create({
        product_name,
        price: parseFloat(price),
        unit: unit || "kg",
        market_type,
        market_name,
        province_id: province_id ? parseInt(province_id) : null,
        grade,
        image_url,
        effective_date: effective_date || new Date(),
        source: source || "manual",
        created_by: created_by || null,
        reported_by: reported_by || null,
        status: status || "published",
      });

      res
        .status(201)
        .json({
          success: true,
          message: "Data harga pangan berhasil ditambahkan",
          data: newPrice,
        });
    } catch (err) {
      console.error("Error create:", err);
      res
        .status(500)
        .json({ success: false, message: "Gagal menambahkan data", error: err.message });
    }
  },

  // ✅ UPDATE
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        product_name,
        price,
        unit,
        market_type,
        market_name,
        province_id,
        grade,
        effective_date,
        source,
        created_by,
        reported_by,
        status,
      } = req.body;

      const priceData = await MarketPrice.findByPk(id);
      if (!priceData)
        return res
          .status(404)
          .json({ success: false, message: "Data tidak ditemukan" });

      const image_url = req.file ? `/uploads/${req.file.filename}` : undefined;

      const updateData = {
        product_name,
        price: parseFloat(price),
        unit: unit || priceData.unit,
        market_type,
        market_name,
        province_id: province_id ? parseInt(province_id) : null,
        grade,
        effective_date: effective_date || priceData.effective_date,
        source: source || priceData.source,
        created_by: created_by || priceData.created_by,
        reported_by: reported_by || priceData.reported_by,
        status: status || priceData.status,
      };
      if (image_url !== undefined) updateData.image_url = image_url;

      await priceData.update(updateData);

      res.json({
        success: true,
        message: "Data berhasil diperbarui",
        data: priceData,
      });
    } catch (err) {
      console.error("Error update:", err);
      res
        .status(500)
        .json({ success: false, message: "Gagal memperbarui data", error: err.message });
    }
  },

  // ✅ DELETE
  remove: async (req, res) => {
    try {
      const { id } = req.params;
      const priceData = await MarketPrice.findByPk(id);
      if (!priceData)
        return res
          .status(404)
          .json({ success: false, message: "Data tidak ditemukan" });

      await priceData.destroy();
      res.json({ success: true, message: "Data berhasil dihapus" });
    } catch (err) {
      console.error("Error delete:", err);
      res
        .status(500)
        .json({ success: false, message: "Gagal menghapus data", error: err.message });
    }
  },

  // ✅ IMPORT CSV
  importCSV: async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ success: false, message: "File CSV diperlukan" });

      const results = [];
      const errors = [];

      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => results.push(row))
        .on("end", async () => {
          try {
            let successCount = 0;

            for (let i = 0; i < results.length; i++) {
              try {
                const item = results[i];
                if (!item.product_name || !item.price || !item.market_type) {
                  errors.push(`Baris ${i + 1}: Data tidak lengkap`);
                  continue;
                }

                await MarketPrice.create({
                  product_name: item.product_name,
                  price: parseFloat(item.price),
                  unit: item.unit || "kg",
                  market_type: item.market_type,
                  market_name: item.market_name || null,
                  province_id: item.province_id ? parseInt(item.province_id) : null,
                  grade: item.grade || null,
                  image_url: item.image_url || null,
                  effective_date: item.effective_date || new Date(),
                  source: "import_csv",
                  created_by: item.created_by || null,
                  reported_by: item.reported_by || null,
                  status: item.status || "published",
                });

                successCount++;
              } catch (error) {
                errors.push(`Baris ${i + 1}: ${error.message}`);
              }
            }

            fs.unlinkSync(req.file.path);

            res.json({
              success: true,
              message: `Import selesai. ${successCount} data berhasil, ${errors.length} gagal`,
              data: {
                success_count: successCount,
                error_count: errors.length,
                errors: errors.slice(0, 10),
              },
            });
          } catch (error) {
            console.error("CSV import insert error:", error);
            res
              .status(500)
              .json({ success: false, message: "Gagal import CSV", error: error.message });
          }
        })
        .on("error", (error) => {
          console.error("CSV parsing error:", error);
          res
            .status(500)
            .json({ success: false, message: "Gagal membaca file CSV", error: error.message });
        });
    } catch (err) {
      console.error("CSV import error:", err);
      res
        .status(500)
        .json({ success: false, message: "Gagal import CSV", error: err.message });
    }
  },

  // ✅ STATISTICS
  getStatistics: async (req, res) => {
    try {
      const totalProducts = await MarketPrice.count();
      const avgPrice = await MarketPrice.findOne({
        attributes: [[fn("AVG", col("price")), "average"]],
      });
      const maxPrice = await MarketPrice.findOne({
        attributes: [[fn("MAX", col("price")), "maximum"]],
      });
      const minPrice = await MarketPrice.findOne({
        attributes: [[fn("MIN", col("price")), "minimum"]],
      });

      const marketTypes = await MarketPrice.findAll({
        attributes: ["market_type", [fn("COUNT", col("market_type")), "count"]],
        group: ["market_type"],
      });

      res.json({
        success: true,
        message: "Statistik berhasil diambil",
        data: {
          total_products: totalProducts,
          average_price: parseFloat(avgPrice.dataValues.average || 0).toFixed(2),
          max_price: parseFloat(maxPrice.dataValues.maximum || 0),
          min_price: parseFloat(minPrice.dataValues.minimum || 0),
          market_types: marketTypes.map((item) => ({
            type: item.market_type,
            count: parseInt(item.dataValues.count),
          })),
        },
      });
    } catch (err) {
      console.error("Error getStatistics:", err);
      res
        .status(500)
        .json({ success: false, message: "Gagal mengambil statistik", error: err.message });
    }
  },
};

module.exports = marketPriceController;
