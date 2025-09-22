const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");

const authController = {
  register: async (req, res) => {
    try {
      const { username, email, password, full_name, role = "viewer" } = req.body;

      // Cek user exist
      const existingUser = await User.findOne({
        where: { [Op.or]: [{ username }, { email }] },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username atau email sudah terdaftar",
        });
      }

      const user = await User.create({ username, email, password, full_name, role });

      const userResponse = user.toJSON();
      delete userResponse.password;

      res.status(201).json({
        success: true,
        message: "Registrasi berhasil",
        data: userResponse,
      });
    } catch (error) {
      console.error("Error register:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  login: async (req, res) => {
    try {
      const { email, username, password } = req.body;
      const identifier = email || username;

      const user = await User.findOne({
        where: { [Op.or]: [{ username: identifier }, { email: identifier }] },
      });

      if (!user || !(await user.validatePassword(password))) {
        return res.status(401).json({ success: false, message: "Kredensial salah" });
      }

      if (!user.is_active) {
        return res.status(403).json({ success: false, message: "Akun tidak aktif" });
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "1h" }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || "your-refresh-secret",
        { expiresIn: "7d" }
      );

      await user.update({ last_login: new Date() });

      await AuditLog.create({
        user_id: user.id,
        action: "user_login",
        entity_type: "user",
        entity_id: user.id,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      res.json({
        success: true,
        message: "Login berhasil",
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      console.error("Error login:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token required" });

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || "your-refresh-secret");
      const user = await User.findByPk(decoded.id);

      if (!user || !user.is_active) {
        return res.status(403).json({ success: false, message: "Invalid refresh token" });
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "1h" }
      );

      res.json({ success: true, data: { accessToken } });
    } catch (error) {
      res.status(401).json({ success: false, message: "Invalid refresh token" });
    }
  },

  logout: async (req, res) => {
    try {
      await AuditLog.create({
        user_id: req.user.id,
        action: "user_logout",
        entity_type: "user",
        entity_id: req.user.id,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      res.json({ success: true, message: "Logout berhasil" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getProfile: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, { attributes: { exclude: ["password"] } });
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = authController;
