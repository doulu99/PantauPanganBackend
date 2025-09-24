// ==========================================
// 1. models/SembakoPrice.js
// ==========================================
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SembakoPrice = sequelize.define("SembakoPrice", {
  // Data umum
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  province_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  market_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  survey_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  
  // 9 Bahan Pokok (Sembako)
  harga_beras: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga beras per kg",
  },
  harga_gula: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga gula per kg",
  },
  harga_minyak: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga minyak goreng per liter",
  },
  harga_daging: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga daging sapi per kg",
  },
  harga_ayam: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga ayam per kg",
  },
  harga_telur: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga telur per kg",
  },
  harga_bawang_merah: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga bawang merah per kg",
  },
  harga_bawang_putih: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga bawang putih per kg",
  },
  harga_gas: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga gas LPG 3kg per tabung",
  },
  harga_garam: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga garam per kg",
  },
  harga_susu: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: "Harga susu per liter/kemasan",
  },
  
  // Meta data
  source: {
    type: DataTypes.ENUM("google_form", "google_sheet", "manual", "import_csv"),
    allowNull: false,
    defaultValue: "manual",
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("draft", "published", "archived"),
    defaultValue: "published",
  },
}, {
  tableName: "sembako_prices",
  timestamps: true,
  indexes: [
    {
      fields: ["province_name", "survey_date"],
      name: "idx_province_date"
    },
    {
      fields: ["market_name"],
      name: "idx_market_name"
    },
    {
      fields: ["survey_date"],
      name: "idx_survey_date"
    },
    {
      fields: ["status"],
      name: "idx_status"
    }
  ]
});

module.exports = SembakoPrice;