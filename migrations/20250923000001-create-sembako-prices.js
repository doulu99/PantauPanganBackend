// migrations/20250923000001-create-sembako-prices.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sembako_prices', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      province_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      market_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      survey_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      // 9 Bahan Pokok Sembako
      harga_beras: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga beras per kg"
      },
      harga_gula: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga gula per kg"
      },
      harga_minyak: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga minyak goreng per liter"
      },
      harga_daging: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga daging sapi per kg"
      },
      harga_ayam: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga ayam per kg"
      },
      harga_telur: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga telur per kg"
      },
      harga_bawang_merah: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga bawang merah per kg"
      },
      harga_bawang_putih: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga bawang putih per kg"
      },
      harga_gas: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga gas LPG 3kg per tabung"
      },
      harga_garam: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga garam per kg"
      },
      harga_susu: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Harga susu per liter/kemasan"
      },
      // Meta fields
      source: {
        type: Sequelize.ENUM('google_form', 'google_sheet', 'manual', 'import_csv'),
        allowNull: false,
        defaultValue: 'manual'
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users', // sesuaikan dengan nama tabel users Anda
          key: 'id'
        }
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'archived'),
        defaultValue: 'published'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Tambahkan indexes untuk optimasi query
    await queryInterface.addIndex('sembako_prices', {
      fields: ['province_name', 'survey_date'],
      name: 'idx_province_date'
    });

    await queryInterface.addIndex('sembako_prices', {
      fields: ['market_name'],
      name: 'idx_market_name'
    });

    await queryInterface.addIndex('sembako_prices', {
      fields: ['survey_date'],
      name: 'idx_survey_date'
    });

    await queryInterface.addIndex('sembako_prices', {
      fields: ['status'],
      name: 'idx_status'
    });

    await queryInterface.addIndex('sembako_prices', {
      fields: ['source'],
      name: 'idx_source'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sembako_prices');
  }
};