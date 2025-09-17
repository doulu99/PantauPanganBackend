// controllers/overrideController.js
const { PriceOverride, Price, Commodity, User, AuditLog } = require('../models');
const { Op } = require('sequelize');

const overrideController = {
  /**
   * Get all overrides with filters
   */
  getOverrides: async (req, res) => {
    try {
      const { 
        status,
        commodity_id,
        start_date,
        end_date,
        page = 1,
        limit = 20
      } = req.query;

      const whereClause = {};
      
      if (status) whereClause.status = status;
      if (commodity_id) whereClause['$Price.commodity_id$'] = commodity_id;
      
      if (start_date && end_date) {
        whereClause.createdAt = {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await PriceOverride.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Price,
            include: [{
              model: Commodity,
              attributes: ['name', 'unit']
            }]
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'full_name']
          },
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'full_name']
          }
        ],
        limit: parseInt(limit),
        offset: offset,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching overrides:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch overrides',
        error: error.message
      });
    }
  },

  /**
   * Create new price override
   */
  createOverride: async (req, res) => {
    try {
      const {
        commodity_id,
        date,
        override_price,
        reason,
        source_info,
        region_id
      } = req.body;

      // Validate price range (prevent unrealistic values)
      const commodity = await Commodity.findByPk(commodity_id);
      if (!commodity) {
        return res.status(404).json({
          success: false,
          message: 'Commodity not found'
        });
      }

      // Get current price
      const currentPrice = await Price.findOne({
        where: {
          commodity_id,
          date: date || new Date().toISOString().split('T')[0],
          region_id: region_id || null
        }
      });

      if (!currentPrice) {
        return res.status(404).json({
          success: false,
          message: 'No current price found for this commodity'
        });
      }

      // Check if price difference is too large (>50%)
      const priceDiff = Math.abs(override_price - currentPrice.price);
      const diffPercentage = (priceDiff / currentPrice.price) * 100;

      let status = 'approved';
      let approved_by = req.user.id;

      // Require approval for large differences
      if (diffPercentage > 50) {
        if (req.user.role !== 'admin') {
          status = 'pending';
          approved_by = null;
        }
      }

      // Create override record
      const override = await PriceOverride.create({
        price_id: currentPrice.id,
        original_price: currentPrice.price,
        override_price,
        reason,
        source_info,
        evidence_url: req.file ? `/uploads/${req.file.filename}` : null,
        created_by: req.user.id,
        approved_by,
        status,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // If approved, update the actual price
      if (status === 'approved') {
        await currentPrice.update({
          price: override_price,
          source: 'manual',
          is_override: true
        });

        // Log the action
        await AuditLog.create({
          user_id: req.user.id,
          action: 'price_override',
          entity_type: 'price',
          entity_id: currentPrice.id,
          old_values: { price: currentPrice.price },
          new_values: { price: override_price },
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        });
      }

      res.status(201).json({
        success: true,
        message: status === 'approved' 
          ? 'Price override created and applied' 
          : 'Price override created, pending approval',
        data: override
      });
    } catch (error) {
      console.error('Error creating override:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create override',
        error: error.message
      });
    }
  },

  /**
   * Update override status (approve/reject)
   */
  updateOverrideStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, rejection_reason } = req.body;

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be approved or rejected'
        });
      }

      const override = await PriceOverride.findByPk(id, {
        include: [{ model: Price }]
      });

      if (!override) {
        return res.status(404).json({
          success: false,
          message: 'Override not found'
        });
      }

      if (override.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Override has already been processed'
        });
      }

      // Update override status
      await override.update({
        status,
        approved_by: req.user.id
      });

      // If approved, apply the override
      if (status === 'approved') {
        await override.Price.update({
          price: override.override_price,
          source: 'manual',
          is_override: true
        });
      }

      // Log the action
      await AuditLog.create({
        user_id: req.user.id,
        action: `override_${status}`,
        entity_type: 'price_override',
        entity_id: override.id,
        new_values: { status, rejection_reason },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: `Override ${status} successfully`,
        data: override
      });
    } catch (error) {
      console.error('Error updating override status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update override status',
        error: error.message
      });
    }
  },

  /**
   * Delete override
   */
  deleteOverride: async (req, res) => {
    try {
      const { id } = req.params;

      const override = await PriceOverride.findByPk(id, {
        include: [{ model: Price }]
      });

      if (!override) {
        return res.status(404).json({
          success: false,
          message: 'Override not found'
        });
      }

      // If override was approved, revert the price
      if (override.status === 'approved') {
        await override.Price.update({
          price: override.original_price,
          source: 'api',
          is_override: false
        });
      }

      // Log before deletion
      await AuditLog.create({
        user_id: req.user.id,
        action: 'override_deleted',
        entity_type: 'price_override',
        entity_id: override.id,
        old_values: override.toJSON(),
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      await override.destroy();

      res.json({
        success: true,
        message: 'Override deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting override:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete override',
        error: error.message
      });
    }
  }
};

module.exports = overrideController;