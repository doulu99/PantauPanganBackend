// controllers/authController.js
const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const { Op } = require('sequelize');

const authController = {
  /**
   * Register new user
   */
  register: async (req, res) => {
    try {
      const { username, email, password, full_name, role = 'viewer' } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ username }, { email }]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username or email already exists'
        });
      }

      // Create user
      const user = await User.create({
        username,
        email,
        password,
        full_name,
        role
      });

      // Remove password from response
      const userResponse = user.toJSON();
      delete userResponse.password;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: userResponse
      });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register user',
        error: error.message
      });
    }
  },

  /**
   * Login user
   */
  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      // Find user
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { username },
            { email: username }
          ]
        }
      });

      if (!user || !(await user.validatePassword(password))) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Generate tokens
      const accessToken = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
        { expiresIn: '7d' }
      );

      // Update last login
      await user.update({ last_login: new Date() });

      // Log login
      await AuditLog.create({
        user_id: user.id,
        action: 'user_login',
        entity_type: 'user',
        entity_id: user.id,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role
          },
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to login',
        error: error.message
      });
    }
  },

  /**
   * Refresh access token
   */
  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
      );

      const user = await User.findByPk(decoded.id);

      if (!user || !user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      const accessToken = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      res.json({
        success: true,
        data: { accessToken }
      });
    } catch (error) {
      console.error('Error refreshing token:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  },

  /**
   * Logout user
   */
  logout: async (req, res) => {
    try {
      // Log logout
      await AuditLog.create({
        user_id: req.user.id,
        action: 'user_logout',
        entity_type: 'user',
        entity_id: req.user.id,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Error logging out:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to logout',
        error: error.message
      });
    }
  },

  /**
   * Get user profile
   */
  getProfile: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] }
      });

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch profile',
        error: error.message
      });
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (req, res) => {
    try {
      const { full_name, email, current_password, new_password } = req.body;

      const user = await User.findByPk(req.user.id);

      // If changing password, verify current password
      if (new_password) {
        if (!current_password || !(await user.validatePassword(current_password))) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
          });
        }
        user.password = new_password;
      }

      // Update other fields
      if (full_name) user.full_name = full_name;
      if (email) user.email = email;

      await user.save();

      const userResponse = user.toJSON();
      delete userResponse.password;

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: userResponse
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }
};

module.exports = authController;
