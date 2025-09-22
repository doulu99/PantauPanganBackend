USE food_price_db;

-- Tabel untuk menyimpan harga pangan
CREATE TABLE IF NOT EXISTS market_prices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  observed_at DATE NOT NULL,
  region_id INT NOT NULL,
  market_name VARCHAR(150) DEFAULT NULL,
  market_type ENUM('traditional','modern','online') NOT NULL,
  commodity VARCHAR(150) NOT NULL,
  unit VARCHAR(50) DEFAULT NULL,
  price DECIMAL(14,2) NOT NULL,
  source VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Relasi ke tabel regions (yang sudah ada)
  CONSTRAINT fk_market_prices_region FOREIGN KEY (region_id) REFERENCES regions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
