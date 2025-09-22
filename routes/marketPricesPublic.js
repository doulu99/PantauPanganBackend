// routes/marketPricesPublic.js
const express = require("express");
const { getAll } = require("../controllers/marketPricesController");

const router = express.Router();

// Public endpoint tanpa token
router.get("/", getAll);

module.exports = router;
