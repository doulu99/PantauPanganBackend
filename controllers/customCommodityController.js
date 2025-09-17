// controllers/customCommodityController.js
const { Op } = require('sequelize');

// Safely import models
const getModels = () => {
  try {
    return require('../models');
  } catch (error) {
    console.warn('Models not loaded:', error.message);
    return {};
  }
};

// GET /api/commodities/custom - Get all custom commodities
const getCustomCommodities = async (req, res) => {
  try {
    const models = getModels();
    const { CustomCommodity, User } = models;

    if (!CustomCommodity) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0
        }
      });
    }

    const { 
      page = 1, 
      limit = 50, 
      search, 
      category,
      created_by 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const where = { is_active: true };

    if (created_by || req.user?.id) {
      where.created_by = created_by || req.user.id;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    if (category) {
      where.category = category;
    }

    const includeUser = User ? [{
      model: User,
      as: 'creator',
      attributes: ['id', 'full_name', 'username'],
      required: false
    }] : [];

    const { count, rows } = await CustomCommodity.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: includeUser
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching custom commodities:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data komoditas custom',
      error: error.message
    });
  }
};

// POST /api/commodities/custom - Create new custom commodity
const createCustomCommodity = async (req, res) => {
  try {
    const models = getModels();
    const { CustomCommodity, User } = models;

    if (!CustomCommodity) {
      return res.status(501).json({
        success: false,
        message: 'Custom commodity feature not implemented yet. Please run migrations first.'
      });
    }

    const { name, unit, category, description } = req.body;
    const created_by = req.user?.id;

    if (!created_by) {
      return res.status(401).json({
        success: false,
        message: 'User tidak terautentikasi'
      });
    }

    if (!name || !unit || !category) {
      return res.status(400).json({
        success: false,
        message: 'Nama, satuan, dan kategori wajib diisi'
      });
    }

    // Check for duplicate
    const existingCommodity = await CustomCommodity.findOne({
      where: {
        name: { [Op.like]: name },
        created_by,
        is_active: true
      }
    });

    if (existingCommodity) {
      return res.status(400).json({
        success: false,
        message: 'Komoditas dengan nama tersebut sudah ada'
      });
    }

    const newCommodity = await CustomCommodity.create({
      name: name.trim(),
      unit: unit.trim(),
      category,
      description: description?.trim(),
      created_by
    });

    // Load with associations if User model exists
    let result = newCommodity;
    if (User) {
      result = await CustomCommodity.findByPk(newCommodity.id, {
        include: [{
          model: User,
          as: 'creator',
          attributes: ['id', 'full_name', 'username'],
          required: false
        }]
      });
    }

    res.status(201).json({
      success: true,
      message: 'Komoditas custom berhasil dibuat',
      data: result
    });
  } catch (error) {
    console.error('Error creating custom commodity:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal membuat komoditas custom',
      error: error.message
    });
  }
};

// GET /api/commodities/custom/:id - Get single custom commodity
const getCustomCommodityById = async (req, res) => {
  try {
    const models = getModels();
    const { CustomCommodity, User } = models;

    if (!CustomCommodity) {
      return res.status(501).json({
        success: false,
        message: 'Custom commodity feature not implemented yet'
      });
    }

    const { id } = req.params;
    
    const includeUser = User ? [{
      model: User,
      as: 'creator',
      attributes: ['id', 'full_name', 'username'],
      required: false
    }] : [];

    const commodity = await CustomCommodity.findOne({
      where: { 
        id, 
        is_active: true 
      },
      include: includeUser
    });

    if (!commodity) {
      return res.status(404).json({
        success: false,
        message: 'Komoditas tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: commodity
    });
  } catch (error) {
    console.error('Error fetching custom commodity:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data komoditas',
      error: error.message
    });
  }
};

// PUT /api/commodities/custom/:id - Update custom commodity
const updateCustomCommodity = async (req, res) => {
  try {
    const models = getModels();
    const { CustomCommodity, User } = models;

    if (!CustomCommodity) {
      return res.status(501).json({
        success: false,
        message: 'Custom commodity feature not implemented yet'
      });
    }

    const { id } = req.params;
    const { name, unit, category, description } = req.body;
    const user_id = req.user?.id;

    const commodity = await CustomCommodity.findOne({
      where: { 
        id, 
        created_by: user_id,
        is_active: true 
      }
    });

    if (!commodity) {
      return res.status(404).json({
        success: false,
        message: 'Komoditas tidak ditemukan atau Anda tidak memiliki akses'
      });
    }

    if (!name || !unit || !category) {
      return res.status(400).json({
        success: false,
        message: 'Nama, satuan, dan kategori wajib diisi'
      });
    }

    // Check for duplicate (exclude current record)
    if (name.trim() !== commodity.name) {
      const existingCommodity = await CustomCommodity.findOne({
        where: {
          name: { [Op.like]: name.trim() },
          created_by: user_id,
          id: { [Op.ne]: id },
          is_active: true
        }
      });

      if (existingCommodity) {
        return res.status(400).json({
          success: false,
          message: 'Komoditas dengan nama tersebut sudah ada'
        });
      }
    }

    await commodity.update({
      name: name.trim(),
      unit: unit.trim(),
      category,
      description: description?.trim()
    });

    // Load updated data
    let result = commodity;
    if (User) {
      result = await CustomCommodity.findByPk(id, {
        include: [{
          model: User,
          as: 'creator',
          attributes: ['id', 'full_name', 'username'],
          required: false
        }]
      });
    }

    res.json({
      success: true,
      message: 'Komoditas berhasil diperbarui',
      data: result
    });
  } catch (error) {
    console.error('Error updating custom commodity:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui komoditas',
      error: error.message
    });
  }
};

// DELETE /api/commodities/custom/:id - Delete custom commodity
const deleteCustomCommodity = async (req, res) => {
  try {
    const models = getModels();
    const { CustomCommodity, MarketPrice } = models;

    if (!CustomCommodity) {
      return res.status(501).json({
        success: false,
        message: 'Custom commodity feature not implemented yet'
      });
    }

    const { id } = req.params;
    const user_id = req.user?.id;

    const commodity = await CustomCommodity.findOne({
      where: { 
        id, 
        created_by: user_id,
        is_active: true 
      }
    });

    if (!commodity) {
      return res.status(404).json({
        success: false,
        message: 'Komoditas tidak ditemukan atau Anda tidak memiliki akses'
      });
    }

    // Check if still used in market_prices
    if (MarketPrice) {
      const marketPriceCount = await MarketPrice.count({
        where: { 
          commodity_id: id,
          commodity_source: 'custom'
        }
      });

      if (marketPriceCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Tidak dapat menghapus komoditas karena masih digunakan dalam ${marketPriceCount} data harga pasar`,
          data: { market_price_count: marketPriceCount }
        });
      }
    }

    // Soft delete
    await commodity.update({ is_active: false });

    res.json({
      success: true,
      message: 'Komoditas berhasil dihapus'
    });
  } catch (error) {
    console.error('Error deleting custom commodity:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus komoditas',
      error: error.message
    });
  }
};

// GET /api/commodities/custom/stats - Get statistics
const getCustomCommodityStats = async (req, res) => {
  try {
    const models = getModels();
    const { CustomCommodity } = models;

    if (!CustomCommodity) {
      return res.json({
        success: true,
        data: {
          total_commodities: 0,
          category_distribution: []
        }
      });
    }

    const user_id = req.user?.id;
    const where = user_id ? { created_by: user_id, is_active: true } : { is_active: true };

    const totalCount = await CustomCommodity.count({ where });
    
    const categoryStats = await CustomCommodity.findAll({
      where,
      attributes: [
        'category',
        [require('sequelize').fn('COUNT', 'id'), 'count']
      ],
      group: ['category'],
      order: [[require('sequelize').fn('COUNT', 'id'), 'DESC']]
    });

    res.json({
      success: true,
      data: {
        total_commodities: totalCount,
        category_distribution: categoryStats.map(stat => ({
          category: stat.category,
          count: parseInt(stat.dataValues.count)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching commodity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil statistik komoditas',
      error: error.message
    });
  }
};

module.exports = {
  getCustomCommodities,
  createCustomCommodity,
  getCustomCommodityById,
  updateCustomCommodity,
  deleteCustomCommodity,
  getCustomCommodityStats
};