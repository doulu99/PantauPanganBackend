// controllers/bpnPublicController.js
const axios = require("axios");

const BPN_API_URL =
  "https://api-panelhargav2.badanpangan.go.id/api/front/harga-pangan-informasi";

exports.getPublicPrices = async (req, res) => {
  try {
    const { province_id = "", city_id = "", level_harga_id = 3 } = req.query;

    const response = await axios.get(BPN_API_URL, {
      params: { province_id, city_id, level_harga_id },
    });

    res.json({
      success: true,
      source: "Badan Pangan Nasional",
      data: response.data.data,
      request_data: response.data.request_data,
    });
  } catch (error) {
    console.error("Error fetching BPN public data:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data dari BPN",
      error: error.message,
    });
  }
};
