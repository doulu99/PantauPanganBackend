// migrations/20250121000002-add-market-price-columns-safe.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Get existing table description
      const tableDescription = await queryInterface.describeTable('market_prices');
      
      console.log('🔍 Checking existing columns in market_prices table...');
      
      // Add columns only if they don't exist
      const columnsToAdd = [
        {
          name: 'commodity_source',
          definition: {
            type: Sequelize.ENUM('national', 'custom'),
            allowNull: false,
            defaultValue: 'national'
          }
        },
        {
          name: 'market_type',
          definition: {
            type: Sequelize.ENUM('traditional', 'modern', 'wholesale', 'online'),
            allowNull: false,
            defaultValue: 'traditional'
          }
        },
        {
          name: 'city_name',
          definition: {
            type: Sequelize.STRING(100),
            allowNull: true
          }
        },
        {
          name: 'unit',
          definition: {
            type: Sequelize.STRING(50),
            allowNull: true
          }
        },
        {
          name: 'time_recorded',
          definition: {
            type: Sequelize.TIME,
            allowNull: true
          }
        },
        {
          name: 'image_url',
          definition: {
            type: Sequelize.STRING(500),
            allowNull: true
          }
        },
        {
          name: 'import_batch_id',
          definition: {
            type: Sequelize.STRING(100),
            allowNull: true
          }
        },
        {
          name: 'verification_status',
          definition: {
            type: Sequelize.ENUM('pending', 'verified', 'rejected'),
            defaultValue: 'pending'
          }
        },
        {
          name: 'verified_by',
          definition: {
            type: Sequelize.INTEGER,
            allowNull: true
          }
        },
        {
          name: 'verified_at',
          definition: {
            type: Sequelize.DATE,
            allowNull: true
          }
        },
        {
          name: 'reported_by',
          definition: {
            type: Sequelize.INTEGER,
            allowNull: true
          }
        },
        {
          name: 'latitude',
          definition: {
            type: Sequelize.DECIMAL(10, 8),
            allowNull: true
          }
        },
        {
          name: 'longitude',
          definition: {
            type: Sequelize.DECIMAL(11, 8),
            allowNull: true
          }
        },
        {
          name: 'is_active',
          definition: {
            type: Sequelize.BOOLEAN,
            defaultValue: true
          }
        }
      ];

      for (const column of columnsToAdd) {
        if (!tableDescription[column.name]) {
          console.log(`➕ Adding column: ${column.name}`);
          await queryInterface.addColumn('market_prices', column.name, column.definition);
        } else {
          console.log(`✅ Column ${column.name} already exists, skipping`);
        }
      }

      // Add indexes if they don't exist
      try {
        await queryInterface.addIndex('market_prices', {
          fields: ['commodity_id'],
          name: 'idx_market_prices_commodity_id'
        });
      } catch (e) {
        console.log('Index commodity_id already exists');
      }

      try {
        await queryInterface.addIndex('market_prices', {
          fields: ['market_type'],
          name: 'idx_market_prices_market_type'
        });
      } catch (e) {
        console.log('Index market_type already exists');
      }

      try {
        await queryInterface.addIndex('market_prices', {
          fields: ['verification_status'],
          name: 'idx_market_prices_verification'
        });
      } catch (e) {
        console.log('Index verification_status already exists');
      }

      console.log('✅ Migration completed successfully');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove added columns
    const columnsToRemove = [
      'commodity_source', 'city_name', 'unit', 'time_recorded',
      'image_url', 'import_batch_id', 'verification_status',
      'verified_by', 'verified_at', 'reported_by', 'latitude',
      'longitude', 'is_active'
    ];

    for (const column of columnsToRemove) {
      try {
        await queryInterface.removeColumn('market_prices', column);
      } catch (e) {
        console.log(`Column ${column} doesn't exist or already removed`);
      }
    }
  }
};