// models/MarketPrice.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MarketPrice = sequelize.define('MarketPrice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  commodity_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'ID dari tabel commodities atau custom_commodities'
  },
  commodity_source: {
    type: DataTypes.ENUM('national', 'custom'),
    allowNull: false,
    defaultValue: 'national',
    comment: 'Sumber komoditas: national (dari Badan Pangan) atau custom (user-defined)'
  },
  market_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    comment: 'Nama pasar tempat pencatatan harga'
  },
  market_type: {
    type: DataTypes.ENUM('traditional', 'modern', 'wholesale', 'online'),
    allowNull: false,
    defaultValue: 'traditional',
    comment: 'Jenis pasar'
  },
  market_location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Alamat lengkap pasar'
  },
  province_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nama provinsi'
  },
  city_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nama kota/kabupaten'
  },
  price: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'Harga dalam rupiah'
  },
  unit: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Satuan harga (kg, liter, dll)'
  },
  quality_grade: {
    type: DataTypes.ENUM('premium', 'standard', 'economy'),
    defaultValue: 'standard',
    comment: 'Kualitas barang'
  },
  date_recorded: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Tanggal pencatatan harga'
  },
  time_recorded: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Waktu pencatatan harga'
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL foto produk/struk sebagai bukti'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Catatan tambahan'
  },
  source: {
    type: DataTypes.ENUM('manual', 'import', 'api'),
    defaultValue: 'manual',
    comment: 'Sumber data entry'
  },
  import_batch_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'ID batch untuk tracking import'
  },
  verification_status: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    defaultValue: 'pending',
    comment: 'Status verifikasi data'
  },
  verified_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID user yang memverifikasi'
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Waktu verifikasi'
  },
  reported_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID user yang melaporkan/input data'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
    comment: 'Koordinat latitude lokasi'
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
    comment: 'Koordinat longitude lokasi'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Status aktif data'
  }
}, {
  tableName: 'market_prices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['commodity_id', 'commodity_source']
    },
    {
      fields: ['market_name']
    },
    {
      fields: ['market_type']
    },
    {
      fields: ['province_name']
    },
    {
      fields: ['date_recorded']
    },
    {
      fields: ['verification_status']
    },
    {
      fields: ['source']
    },
    {
      fields: ['import_batch_id']
    }
  ]
});

// Instance methods
MarketPrice.prototype.getCommodityInfo = async function() {
  try {
    if (this.commodity_source === 'custom') {
      const { CustomCommodity } = require('./index');
      if (CustomCommodity) {
        const commodity = await CustomCommodity.findByPk(this.commodity_id, {
          attributes: ['id', 'name', 'unit', 'category', 'description']
        });
        return commodity ? { ...commodity.toJSON(), source: 'custom' } : null;
      }
    } else {
      const { Commodity } = require('./index');
      if (Commodity) {
        const commodity = await Commodity.findByPk(this.commodity_id, {
          attributes: ['id', 'name', 'unit', 'category']
        });
        return commodity ? { ...commodity.toJSON(), source: 'national' } : null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching commodity info:', error);
    return null;
  }
};

MarketPrice.prototype.getReporter = async function() {
  try {
    if (this.reported_by) {
      const { User } = require('./index');
      if (User) {
        const user = await User.findByPk(this.reported_by, {
          attributes: ['id', 'full_name', 'username']
        });
        return user ? user.toJSON() : null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching reporter info:', error);
    return null;
  }
};

module.exports = MarketPrice;