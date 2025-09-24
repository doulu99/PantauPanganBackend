// ==========================================
// 2. services/googleSheetsService.js - UPDATED with GID support
// ==========================================
const axios = require('axios');
const SembakoPrice = require('../models/SembakoPrice');
const { Op } = require('sequelize');

class GoogleSheetsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    this.sheetId = process.env.GOOGLE_SHEET_ID;
    this.sheetGid = process.env.GOOGLE_SHEET_GID; // NEW: Support for specific sheet GID
    this.range = process.env.GOOGLE_SHEET_RANGE || 'A:N';
    this.sheetName = process.env.GOOGLE_SHEET_NAME || 'Form Responses 1';
    this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    
    console.log('📊 Google Sheets Service Configuration:');
    console.log(`   • Sheet ID: ${this.sheetId}`);
    console.log(`   • GID: ${this.sheetGid || 'Not specified'}`);
    console.log(`   • Range: ${this.range}`);
    console.log(`   • Sheet Name: ${this.sheetName}`);
  }

  /**
   * Get sheet info and find correct sheet name by GID
   */
  async getSheetNameByGid() {
    try {
      if (!this.sheetGid) {
        return this.sheetName; // Use default if no GID specified
      }

      const url = `${this.baseUrl}/${this.sheetId}?key=${this.apiKey}`;
      const response = await axios.get(url);
      
      const sheet = response.data.sheets.find(s => s.properties.sheetId.toString() === this.sheetGid);
      
      if (sheet) {
        const foundSheetName = sheet.properties.title;
        console.log(`📋 Found sheet by GID ${this.sheetGid}: "${foundSheetName}"`);
        return foundSheetName;
      } else {
        console.warn(`⚠️  Sheet with GID ${this.sheetGid} not found, using default: "${this.sheetName}"`);
        return this.sheetName;
      }
    } catch (error) {
      console.warn(`⚠️  Error getting sheet name by GID: ${error.message}, using default: "${this.sheetName}"`);
      return this.sheetName;
    }
  }

  /**
   * Fetch data dari Google Sheet dengan support untuk specific GID
   */
  async fetchSheetData() {
    try {
      // Get correct sheet name based on GID
      const actualSheetName = await this.getSheetNameByGid();
      const fullRange = `'${actualSheetName}'!${this.range}`;
      
      const url = `${this.baseUrl}/${this.sheetId}/values/${encodeURIComponent(fullRange)}?key=${this.apiKey}`;
      
      console.log('🔍 Fetching data from Google Sheet...');
      console.log(`   • URL: ${url}`);
      console.log(`   • Sheet Name: ${actualSheetName}`);
      console.log(`   • Range: ${this.range}`);
      
      const response = await axios.get(url);
      
      if (!response.data.values || response.data.values.length === 0) {
        console.log('⚠️  No data found in Google Sheet');
        return [];
      }

      const rows = response.data.values;
      const headers = rows[0]; // Row pertama adalah header
      const dataRows = rows.slice(1); // Skip header row

      console.log(`📊 Found ${dataRows.length} rows in Google Sheet`);
      console.log(`📋 Headers: ${headers.join(', ')}`);
      
      // Show sample of first few rows for debugging
      if (dataRows.length > 0) {
        console.log('📄 Sample data (first row):');
        headers.forEach((header, index) => {
          console.log(`   • ${header}: ${dataRows[0][index] || 'NULL'}`);
        });
      }
      
      // Convert ke object format
      const data = dataRows.map((row, index) => {
        const rowData = {};
        headers.forEach((header, headerIndex) => {
          rowData[header] = row[headerIndex] || null;
        });
        rowData._originalRowIndex = index + 2; // +2 karena index dimulai dari 0 dan skip header
        return rowData;
      });

      return data;
    } catch (error) {
      console.error('❌ Error fetching Google Sheet data:', error.response?.data || error.message);
      
      if (error.response?.status === 403) {
        throw new Error('Google Sheets API access denied. Check API key and permissions.');
      } else if (error.response?.status === 404) {
        throw new Error('Google Sheet not found. Check Sheet ID and range.');
      } else {
        throw new Error(`Failed to fetch Google Sheet: ${error.message}`);
      }
    }
  }

  /**
   * Map data Google Sheet ke format database - ENHANCED
   */
  mapSheetDataToDatabase(sheetRow) {
    try {
      console.log(`🔄 Mapping row data:`, Object.keys(sheetRow));
      
      // Multiple possible field mappings untuk flexibility
      const fieldMappings = {
        // Timestamp fields
        timestamp: ['Timestamp', 'timestamp', 'Tanggal Input', 'Created'],
        
        // Location fields  
        province_name: ['Province ID', 'province_id', 'Provinsi', 'Province'],
        market_name: ['Nama Pasar', 'nama_pasar', 'market_name', 'Pasar', 'Market Name'],
        survey_date: ['Tanggal', 'tanggal', 'Date', 'Survey Date', 'Tanggal Survei'],
        
        // Price fields - 9 Sembako + 2 Bonus
        harga_beras: ['Harga Beras', 'harga_beras', 'Beras', 'Rice Price'],
        harga_gula: ['Harga Gula', 'harga_gula', 'Gula', 'Sugar Price'],
        harga_minyak: ['Harga Minyak', 'harga_minyak', 'Minyak', 'Oil Price', 'Minyak Goreng'],
        harga_daging: ['Harga Daging', 'harga_daging', 'Daging', 'Meat Price', 'Daging Sapi'],
        harga_ayam: ['Harga Ayam', 'harga_ayam', 'Ayam', 'Chicken Price'],
        harga_telur: ['Harga Telur', 'harga_telur', 'Telur', 'Egg Price'],
        harga_bawang_merah: ['Harga Bawang Merah', 'harga_bawang_merah', 'Bawang Merah', 'Red Onion Price'],
        harga_bawang_putih: ['Harga Bawang Putih', 'harga_bawang_putih', 'Bawang Putih', 'Garlic Price'],
        harga_gas: ['Harga Gas', 'harga_gas', 'Gas', 'Gas Price', 'Gas LPG'],
        harga_garam: ['Harga Garam', 'harga_garam', 'Garam', 'Salt Price'],
        harga_susu: ['Harga Susu', 'harga_susu', 'Susu', 'Milk Price']
      };

      // Smart field mapping
      const mappedData = {
        source: 'google_sheet',
        status: 'published',
      };

      // Map each field using multiple possible names
      Object.keys(fieldMappings).forEach(dbField => {
        const possibleFields = fieldMappings[dbField];
        let value = null;
        
        for (const fieldName of possibleFields) {
          if (sheetRow[fieldName] !== undefined && sheetRow[fieldName] !== null) {
            value = sheetRow[fieldName];
            console.log(`   ✓ ${dbField}: ${fieldName} → ${value}`);
            break;
          }
        }
        
        if (value !== null) {
          if (dbField === 'timestamp' || dbField === 'survey_date') {
            mappedData[dbField] = this.parseDate(value);
          } else if (dbField.startsWith('harga_')) {
            mappedData[dbField] = this.parsePrice(value);
          } else {
            mappedData[dbField] = value;
          }
        } else if (dbField === 'survey_date') {
          // Default survey_date jika tidak ada
          mappedData[dbField] = new Date();
        }
      });

      // Validasi data wajib
      if (!mappedData.province_name || !mappedData.market_name) {
        throw new Error(`Missing required fields: province_name="${mappedData.province_name}", market_name="${mappedData.market_name}"`);
      }

      // Cek apakah minimal ada satu harga
      const priceFields = [
        'harga_beras', 'harga_gula', 'harga_minyak', 'harga_daging', 
        'harga_ayam', 'harga_telur', 'harga_bawang_merah', 
        'harga_bawang_putih', 'harga_gas', 'harga_garam', 'harga_susu'
      ];
      
      const hasValidPrice = priceFields.some(field => 
        mappedData[field] !== null && mappedData[field] !== undefined && mappedData[field] > 0
      );

      if (!hasValidPrice) {
        console.warn('⚠️  No valid prices found in row:', mappedData);
        throw new Error('No valid prices found in row');
      }

      console.log(`✅ Mapped data successfully:`, {
        province: mappedData.province_name,
        market: mappedData.market_name,
        date: mappedData.survey_date,
        prices: priceFields.filter(f => mappedData[f] > 0).length
      });

      return mappedData;
    } catch (error) {
      throw new Error(`Mapping error: ${error.message}`);
    }
  }

  /**
   * Parse tanggal dari berbagai format - ENHANCED
   */
  parseDate(dateString) {
    if (!dateString) return new Date();
    
    try {
      // Handle berbagai format tanggal
      let date;
      
      // Format: "9/23/2025 19:50:23" atau "23/9/2025 19:50:23"
      if (dateString.includes('/') && dateString.includes(':')) {
        date = new Date(dateString);
      }
      // Format: "2025-09-23" 
      else if (dateString.includes('-')) {
        date = new Date(dateString);
      }
      // Format: "23/09/2025" atau "9/23/2025"
      else if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          // Try both formats
          const format1 = new Date(`${parts[0]}/${parts[1]}/${parts[2]}`); // MM/DD/YYYY
          const format2 = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`); // DD/MM/YYYY
          
          date = !isNaN(format1.getTime()) ? format1 : format2;
        }
      }
      else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('⚠️  Date parsing failed, using today:', dateString);
        return new Date();
      }
      
      return date;
    } catch (error) {
      console.warn('⚠️  Date parsing error:', dateString, error.message);
      return new Date();
    }
  }

  /**
   * Parse harga dengan handling currency symbols
   */
  parsePrice(priceString) {
    if (!priceString) return null;
    
    // Remove currency symbols, commas, spaces, dots (except decimal)
    let cleanPrice = String(priceString)
      .replace(/[Rp\s,]/g, '') // Remove Rp, spaces, commas
      .replace(/\.(?=\d{3})/g, '') // Remove thousand separators (dots before 3 digits)
      .trim();
    
    const price = parseFloat(cleanPrice);
    
    if (!isNaN(price) && price > 0) {
      console.log(`   💰 Price parsed: "${priceString}" → ${price}`);
      return price;
    }
    
    return null;
  }

  // Enhanced duplicate detection (dari sebelumnya)
  async isDuplicateData(mappedData) {
    try {
      const exactDuplicate = await SembakoPrice.findOne({
        where: {
          province_name: mappedData.province_name,
          market_name: mappedData.market_name,
          survey_date: mappedData.survey_date,
          source: 'google_sheet'
        }
      });
      
      if (exactDuplicate) {
        console.log(`⏭️  Exact duplicate: ${mappedData.market_name} (${mappedData.province_name}) on ${mappedData.survey_date}`);
        return { isDuplicate: true, type: 'exact', existing: exactDuplicate };
      }

      return { isDuplicate: false, type: 'new' };
      
    } catch (error) {
      console.error('❌ Duplicate check error:', error.message);
      return { isDuplicate: false, type: 'error' };
    }
  }

  // Rest of the methods remain the same...
  async syncToDatabase() {
    const startTime = Date.now();
    const result = {
      total_rows: 0,
      success_count: 0,
      duplicate_count: 0,
      error_count: 0,
      errors: []
    };

    try {
      console.log('🚀 Starting Google Sheet sync...');
      
      const sheetData = await this.fetchSheetData();
      result.total_rows = sheetData.length;

      if (sheetData.length === 0) {
        console.log('✅ No data to sync');
        return result;
      }

      for (let i = 0; i < sheetData.length; i++) {
        try {
          const row = sheetData[i];
          const mappedData = this.mapSheetDataToDatabase(row);
          
          // Check duplicate
          const duplicateCheck = await this.isDuplicateData(mappedData);
          if (duplicateCheck.isDuplicate) {
            result.duplicate_count++;
            console.log(`⏭️  Row ${row._originalRowIndex}: Duplicate data skipped`);
            continue;
          }

          // Insert ke database
          await SembakoPrice.create(mappedData);
          result.success_count++;
          
          console.log(`✅ Row ${row._originalRowIndex}: ${mappedData.market_name} (${mappedData.province_name}) saved`);
          
        } catch (error) {
          result.error_count++;
          const errorMsg = `Row ${sheetData[i]?._originalRowIndex || i + 1}: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`\n📊 SYNC COMPLETED in ${duration}s:`);
      console.log(`   • Total rows: ${result.total_rows}`);
      console.log(`   • Success: ${result.success_count}`);
      console.log(`   • Duplicates: ${result.duplicate_count}`);
      console.log(`   • Errors: ${result.error_count}`);

      return result;

    } catch (error) {
      console.error('❌ Sync process failed:', error.message);
      result.errors.push(`Sync process failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Get sheet info untuk debugging
   */
  async getSheetInfo() {
    try {
      const url = `${this.baseUrl}/${this.sheetId}?key=${this.apiKey}`;
      const response = await axios.get(url);
      
      return {
        title: response.data.properties.title,
        sheetCount: response.data.sheets.length,
        sheets: response.data.sheets.map(sheet => ({
          title: sheet.properties.title,
          sheetId: sheet.properties.sheetId,
          gridProperties: sheet.properties.gridProperties,
          isTargetSheet: sheet.properties.sheetId.toString() === this.sheetGid
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get sheet info: ${error.message}`);
    }
  }
}

module.exports = new GoogleSheetsService();