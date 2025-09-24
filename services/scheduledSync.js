// ==========================================
// 3. services/scheduledSync.js
// ==========================================
const cron = require('node-cron');
const googleSheetsService = require('./googleSheetsService');

class ScheduledSync {
  constructor() {
    this.isRunning = false;
    this.lastSyncTime = null;
    this.syncCount = 0;
  }

  /**
   * Start automatic sync schedule
   */
  start() {
    const intervalHours = process.env.SYNC_INTERVAL_HOURS || 6;
    const cronExpression = `0 */${intervalHours} * * *`; // Every X hours
    
    console.log(`📅 Starting scheduled Google Sheet sync every ${intervalHours} hours`);
    
    cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        console.log('⏳ Sync already running, skipping...');
        return;
      }

      await this.runSync();
    });

    // Run initial sync after 30 seconds
    setTimeout(() => {
      this.runSync();
    }, 30000);
  }

  /**
   * Run sync process
   */
  async runSync() {
    try {
      this.isRunning = true;
      this.syncCount++;
      
      console.log(`\n🔄 SCHEDULED SYNC #${this.syncCount} STARTED`);
      console.log(`   Time: ${new Date().toLocaleString('id-ID')}`);
      
      const result = await googleSheetsService.syncToDatabase();
      
      this.lastSyncTime = new Date();
      
      console.log(`✅ SCHEDULED SYNC #${this.syncCount} COMPLETED`);
      console.log(`   Next sync: ${new Date(Date.now() + (process.env.SYNC_INTERVAL_HOURS || 6) * 60 * 60 * 1000).toLocaleString('id-ID')}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ SCHEDULED SYNC #${this.syncCount} FAILED:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      is_running: this.isRunning,
      last_sync_time: this.lastSyncTime,
      sync_count: this.syncCount,
      interval_hours: process.env.SYNC_INTERVAL_HOURS || 6
    };
  }
}

module.exports = new ScheduledSync();