// routes/bpnPublicRoutes.js
const express = require("express");
const router = express.Router();
const bpnPublicController = require("../controllers/bpnController");

// Endpoint publik untuk ambil harga pangan nasional langsung dari API BPN
router.get("/public/bpn-prices", bpnPublicController.getPublicPrices);
// routes/bpnRoutes.js
router.get("/trending", async (req, res) => {
  try {
    const data = await getBpnDataSomehow(); // kalau ambil dari API BPN
    const naik = [...data].sort((a, b) => b.gap_percentage - a.gap_percentage)[0];
    const turun = [...data].sort((a, b) => a.gap_percentage - b.gap_percentage)[0];

    res.json({
      success: true,
      trending: {
        highest_increase: naik,
        highest_decrease: turun,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal ambil trending" });
  }
});


module.exports = router;
