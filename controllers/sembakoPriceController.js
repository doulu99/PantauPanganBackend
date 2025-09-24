// ==========================================
// 2. controllers/sembakoPriceController.js
// ==========================================
const SembakoPrice = require("../models/SembakoPrice");
const csv = require("csv-parser");
const fs = require("fs");
const { Op, fn, col } = require("sequelize");

// Daftar 9 sembako dan field mapping
const SEMBAKO_FIELDS = {
  'Harga Beras': 'harga_beras',
  'Harga Gula': 'harga_gula', 
  'Harga Minyak': 'harga_minyak',
  'Harga Daging': 'harga_daging',
  'Harga Ayam': 'harga_ayam',
  'Harga Telur': 'harga_telur',
  'Harga Bawang Merah': 'harga_bawang_merah',
  'Harga Bawang Putih': 'harga_bawang_putih',
  'Harga Gas': 'harga_gas',
  'Harga Garam': 'harga_garam',
  'Harga Susu': 'harga_susu'
};

const sembakoPriceController = {
  // ✅ GET ALL dengan filtering dan pagination
  getAll: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        province_name,
        market_name,
        start_date,
        end_date,
        status,
        sort_by = "survey_date",
        sort_order = "DESC"
      } = req.query;

      const whereClause = {};
      
      if (province_name) {
        whereClause.province_name = { [Op.like]: `%${province_name}%` };
      }
      if (market_name) {
        whereClause.market_name = { [Op.like]: `%${market_name}%` };
      }
      if (status) {
        whereClause.status = status;
      }
      if (start_date && end_date) {
        whereClause.survey_date = {
          [Op.between]: [start_date, end_date]
        };
      } else if (start_date) {
        whereClause.survey_date = { [Op.gte]: start_date };
      } else if (end_date) {
        whereClause.survey_date = { [Op.lte]: end_date };
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const validSortFields = ['survey_date', 'province_name', 'market_name', 'createdAt'];
      const sortField = validSortFields.includes(sort_by) ? sort_by : 'survey_date';
      const sortDirection = ['ASC', 'DESC'].includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

      const { count, rows } = await SembakoPrice.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset,
        order: [[sortField, sortDirection]],
        attributes: {
          exclude: ['created_by'] // Hide sensitive data
        }
      });

      res.json({
        success: true,
        message: "Data sembako berhasil diambil",
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit)),
        },
      });
    } catch (err) {
      console.error("Error getAll sembako:", err);
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data harga sembako",
        error: err.message,
      });
    }
  },

  // ✅ GET BY ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const sembako = await SembakoPrice.findByPk(id);

      if (!sembako) {
        return res.status(404).json({ 
          success: false, 
          message: "Data tidak ditemukan" 
        });
      }

      res.json({
        success: true,
        message: "Data berhasil diambil",
        data: sembako,
      });
    } catch (err) {
      console.error("Error getById sembako:", err);
      res.status(500).json({ 
        success: false, 
        message: "Gagal mengambil data", 
        error: err.message 
      });
    }
  },

  // ✅ CREATE
  create: async (req, res) => {
    try {
      const {
        province_name,
        market_name,
        survey_date,
        harga_beras,
        harga_gula,
        harga_minyak,
        harga_daging,
        harga_ayam,
        harga_telur,
        harga_bawang_merah,
        harga_bawang_putih,
        harga_gas,
        harga_garam,
        harga_susu,
        source,
        created_by,
        status,
      } = req.body;

      // Validasi field wajib
      if (!province_name || !market_name || !survey_date) {
        return res.status(400).json({
          success: false,
          message: "Province name, market name, dan survey date wajib diisi",
        });
      }

      // Validasi minimal ada satu harga yang diisi
      const hargaFields = [harga_beras, harga_gula, harga_minyak, harga_daging, 
                          harga_ayam, harga_telur, harga_bawang_merah, 
                          harga_bawang_putih, harga_gas, harga_garam, harga_susu];
      
      const hasAnyPrice = hargaFields.some(price => price && price > 0);
      if (!hasAnyPrice) {
        return res.status(400).json({
          success: false,
          message: "Minimal satu harga sembako harus diisi",
        });
      }

      const newSembako = await SembakoPrice.create({
        province_name,
        market_name,
        survey_date,
        harga_beras: harga_beras ? parseFloat(harga_beras) : null,
        harga_gula: harga_gula ? parseFloat(harga_gula) : null,
        harga_minyak: harga_minyak ? parseFloat(harga_minyak) : null,
        harga_daging: harga_daging ? parseFloat(harga_daging) : null,
        harga_ayam: harga_ayam ? parseFloat(harga_ayam) : null,
        harga_telur: harga_telur ? parseFloat(harga_telur) : null,
        harga_bawang_merah: harga_bawang_merah ? parseFloat(harga_bawang_merah) : null,
        harga_bawang_putih: harga_bawang_putih ? parseFloat(harga_bawang_putih) : null,
        harga_gas: harga_gas ? parseFloat(harga_gas) : null,
        harga_garam: harga_garam ? parseFloat(harga_garam) : null,
        harga_susu: harga_susu ? parseFloat(harga_susu) : null,
        source: source || "manual",
        created_by: created_by || null,
        status: status || "published",
      });

      res.status(201).json({
        success: true,
        message: "Data harga sembako berhasil ditambahkan",
        data: newSembako,
      });
    } catch (err) {
      console.error("Error create sembako:", err);
      res.status(500).json({ 
        success: false, 
        message: "Gagal menambahkan data", 
        error: err.message 
      });
    }
  },

  // ✅ UPDATE
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const sembakoData = await SembakoPrice.findByPk(id);
      if (!sembakoData) {
        return res.status(404).json({ 
          success: false, 
          message: "Data tidak ditemukan" 
        });
      }

      // Convert harga fields to float jika ada
      Object.keys(SEMBAKO_FIELDS).forEach(key => {
        const fieldName = SEMBAKO_FIELDS[key];
        if (updateData[fieldName]) {
          updateData[fieldName] = parseFloat(updateData[fieldName]);
        }
      });

      await sembakoData.update(updateData);

      res.json({
        success: true,
        message: "Data berhasil diperbarui",
        data: sembakoData,
      });
    } catch (err) {
      console.error("Error update sembako:", err);
      res.status(500).json({ 
        success: false, 
        message: "Gagal memperbarui data", 
        error: err.message 
      });
    }
  },

  // ✅ DELETE
  remove: async (req, res) => {
    try {
      const { id } = req.params;
      const sembakoData = await SembakoPrice.findByPk(id);
      
      if (!sembakoData) {
        return res.status(404).json({ 
          success: false, 
          message: "Data tidak ditemukan" 
        });
      }

      await sembakoData.destroy();
      res.json({ 
        success: true, 
        message: "Data berhasil dihapus" 
      });
    } catch (err) {
      console.error("Error delete sembako:", err);
      res.status(500).json({ 
        success: false, 
        message: "Gagal menghapus data", 
        error: err.message 
      });
    }
  },

  // ✅ IMPORT CSV dari Google Form/Sheet
  importCSV: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: "File CSV diperlukan" 
        });
      }

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
                
                // Mapping field dari Google Form ke database
                const mappedData = {
                  timestamp: item.Timestamp ? new Date(item.Timestamp) : new Date(),
                  province_name: item['Province ID'] || item.province_id || item.provinsi,
                  market_name: item['Nama Pasar'] || item.nama_pasar || item.market_name,
                  survey_date: item['Tanggal'] ? new Date(item.Tanggal) : new Date(),
                  source: "import_csv"
                };

                // Mapping harga sembako
                Object.keys(SEMBAKO_FIELDS).forEach(csvField => {
                  const dbField = SEMBAKO_FIELDS[csvField];
                  if (item[csvField] && !isNaN(parseFloat(item[csvField]))) {
                    mappedData[dbField] = parseFloat(item[csvField]);
                  }
                });

                // Validasi data minimal
                if (!mappedData.province_name || !mappedData.market_name) {
                  errors.push(`Baris ${i + 1}: Province name dan market name wajib diisi`);
                  continue;
                }

                // Cek apakah minimal ada satu harga
                const hasPrice = Object.keys(SEMBAKO_FIELDS).some(key => {
                  const dbField = SEMBAKO_FIELDS[key];
                  return mappedData[dbField] && mappedData[dbField] > 0;
                });

                if (!hasPrice) {
                  errors.push(`Baris ${i + 1}: Minimal satu harga sembako harus diisi`);
                  continue;
                }

                await SembakoPrice.create(mappedData);
                successCount++;

              } catch (error) {
                errors.push(`Baris ${i + 1}: ${error.message}`);
              }
            }

            // Hapus file temporary
            fs.unlinkSync(req.file.path);

            res.json({
              success: true,
              message: `Import selesai. ${successCount} data berhasil, ${errors.length} gagal`,
              data: {
                success_count: successCount,
                error_count: errors.length,
                errors: errors.slice(0, 10), // Tampilkan 10 error pertama
                sample_mapping: Object.keys(SEMBAKO_FIELDS) // Untuk debugging
              },
            });
          } catch (error) {
            console.error("CSV import insert error:", error);
            res.status(500).json({ 
              success: false, 
              message: "Gagal import CSV", 
              error: error.message 
            });
          }
        })
        .on("error", (error) => {
          console.error("CSV parsing error:", error);
          res.status(500).json({ 
            success: false, 
            message: "Gagal membaca file CSV", 
            error: error.message 
          });
        });
    } catch (err) {
      console.error("CSV import error:", err);
      res.status(500).json({ 
        success: false, 
        message: "Gagal import CSV", 
        error: err.message 
      });
    }
  },

  // ✅ STATISTICS untuk dashboard
  getStatistics: async (req, res) => {
    try {
      const totalRecords = await SembakoPrice.count();
      
      // Statistik per provinsi
      const provinceStats = await SembakoPrice.findAll({
        attributes: [
          'province_name',
          [fn('COUNT', col('id')), 'total_records'],
          [fn('MAX', col('survey_date')), 'latest_survey']
        ],
        group: ['province_name'],
        order: [[fn('COUNT', col('id')), 'DESC']]
      });

      // Average harga per sembako (yang tidak null)
      const avgPrices = {};
      for (const field of Object.values(SEMBAKO_FIELDS)) {
        const avg = await SembakoPrice.findOne({
          attributes: [[fn('AVG', col(field)), 'average']],
          where: {
            [field]: { [Op.not]: null }
          }
        });
        avgPrices[field] = avg ? parseFloat(avg.dataValues.average || 0).toFixed(0) : 0;
      }

      // Distribusi data per bulan (3 bulan terakhir)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const monthlyDistribution = await SembakoPrice.findAll({
        attributes: [
          [fn('DATE_FORMAT', col('survey_date'), '%Y-%m'), 'month'],
          [fn('COUNT', col('id')), 'count']
        ],
        where: {
          survey_date: { [Op.gte]: threeMonthsAgo }
        },
        group: [fn('DATE_FORMAT', col('survey_date'), '%Y-%m')],
        order: [[fn('DATE_FORMAT', col('survey_date'), '%Y-%m'), 'ASC']]
      });

      res.json({
        success: true,
        message: "Statistik berhasil diambil",
        data: {
          summary: {
            total_records: totalRecords,
            total_provinces: provinceStats.length,
            latest_update: new Date().toISOString()
          },
          province_stats: provinceStats.map(item => ({
            province: item.province_name,
            total_records: parseInt(item.dataValues.total_records),
            latest_survey: item.dataValues.latest_survey
          })),
          average_prices: avgPrices,
          monthly_distribution: monthlyDistribution.map(item => ({
            month: item.dataValues.month,
            count: parseInt(item.dataValues.count)
          }))
        },
      });
    } catch (err) {
      console.error("Error getStatistics sembako:", err);
      res.status(500).json({ 
        success: false, 
        message: "Gagal mengambil statistik", 
        error: err.message 
      });
    }
  },

  // ✅ GET latest prices per province untuk dashboard
  getLatestPrices: async (req, res) => {
    try {
      const { province } = req.query;
      
      let whereClause = { status: 'published' };
      if (province) {
        whereClause.province_name = { [Op.like]: `%${province}%` };
      }

      // Ambil data terbaru per provinsi
      const latestPrices = await SembakoPrice.findAll({
        where: whereClause,
        order: [['survey_date', 'DESC']],
        limit: province ? 10 : 50 // Jika filter provinsi, ambil 10, jika tidak 50
      });

      res.json({
        success: true,
        message: "Data harga terbaru berhasil diambil",
        data: latestPrices
      });
    } catch (err) {
      console.error("Error getLatestPrices:", err);
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data harga terbaru",
        error: err.message
      });
    }
  },
};

module.exports = sembakoPriceController;