// routes/regionRoutes.js
const express = require("express");
const router = express.Router();
const { Region } = require("../models");

// GET all provinces
router.get("/provinces", async (req, res) => {
  try {
    const provinces = await Region.findAll({
      where: { level: "province" },
      attributes: ["id", "province_id", "province_name"],
      order: [["province_name", "ASC"]],
    });
    res.json(provinces);
  } catch (err) {
    console.error("Error fetching provinces:", err);
    res.status(500).json({ message: "Failed to fetch provinces" });
  }
});

// GET cities by province_id
router.get("/cities/:provinceId", async (req, res) => {
  try {
    const { provinceId } = req.params;
    const cities = await Region.findAll({
      where: { province_id: provinceId, level: "city" },
      attributes: ["id", "city_id", "city_name"],
      order: [["city_name", "ASC"]],
    });
    res.json(cities);
  } catch (err) {
    console.error("Error fetching cities:", err);
    res.status(500).json({ message: "Failed to fetch cities" });
  }
});

module.exports = router;
