// models/MarketPrice.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MarketPrice = sequelize.define("MarketPrice", {
  product_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  unit: { // harga per apa (kg, liter, ikat, pack, dll)
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "kg",
  },
  market_type: {
    type: DataTypes.ENUM(
      "Pasar Tradisional",
      "Pasar Modern",
      "Grosir",
      "Online Shop"
    ),
    allowNull: false,
  },
  market_name: { // nama pasar spesifik
    type: DataTypes.STRING,
    allowNull: true,
  },
  province_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  grade: {
    type: DataTypes.ENUM("Premium", "Standar", "Grade A", "Grade B", "Grade C"),
    allowNull: true,
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  effective_date: { // kapan harga ini berlaku
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  source: { // asal data
    type: DataTypes.ENUM("manual", "bpn", "import_csv"),
    allowNull: false,
    defaultValue: "manual",
  },
  created_by: { // siapa yang input
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  reported_by: { // ✅ tambahan untuk pelapor
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: { // moderasi data
    type: DataTypes.ENUM("draft", "published", "archived"),
    defaultValue: "published",
  },
}, {
  tableName: "marketprices",
  timestamps: true,
});

module.exports = MarketPrice;
