const fs = require('fs');
const { parse } = require('csv-parse');
const MarketPrice = require('../models/MarketPrice');

async function importCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (row) => records.push(row))
      .on('end', async () => {
        try {
          let imported = 0;
          for (const r of records) {
            if (!r.observed_at || !r.region_id || !r.commodity || !r.price || !r.market_type) continue;
            await MarketPrice.create({
              observed_at: r.observed_at,
              region_id: r.region_id,
              province_name: r.province_name || null,
              city_name: r.city_name || null,
              market_name: r.market_name || null,
              market_type: r.market_type.toLowerCase(),
              commodity: r.commodity,
              unit: r.unit || null,
              price: r.price,
              source: r.source || null,
            });
            imported++;
          }
          fs.unlinkSync(filePath);
          resolve({ imported, total: records.length });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

module.exports = { importCsvFile };
