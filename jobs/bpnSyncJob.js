// ================================
// Scheduled sync job (optional)
// jobs/bpnSyncJob.js
// ================================

const cron = require('node-cron');
const bpnApiService = require('../services/bpnApiService');

class BPNSyncJob {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start scheduled sync job
   * Runs every day at 6:00 AM
   */
  start() {
    console.log('🕒 Starting BPN sync scheduler...');
    
    // Run daily at 6:00 AM
    cron.schedule('0 6 * * *', async () => {
      if (this.isRunning) {
        console.log('⚠️ BPN sync already running, skipping...');
        return;
      }

      try {
        this.isRunning = true;
        console.log('🔄 Starting scheduled BPN sync...');
        
        const result = await bpnApiService.fullSync({
          levelHargaId: 3 // konsumen level
        });

        if (result.success) {
          console.log('✅ Scheduled BPN sync completed:', result.message);
        } else {
          console.error('❌ Scheduled BPN sync failed:', result.message);
        }

      } catch (error) {
        console.error('❌ Scheduled BPN sync error:', error.message);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ BPN sync scheduler started (daily at 6:00 AM)');
  }

  /**
   * Manual trigger for testing
   */
  async runNow() {
    if (this.isRunning) {
      throw new Error('Sync job is already running');
    }

    try {
      this.isRunning = true;
      console.log('🔄 Manual BPN sync triggered...');
      
      const result = await bpnApiService.fullSync();
      return result;
      
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new BPNSyncJob();