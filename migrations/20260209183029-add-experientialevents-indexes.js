/**
 * Migration: Add indexes for experientialevents collection
 * 
 * Purpose:
 * - Optimize vendor queries (createdBy)
 * - Improve filtering by status (isActive, isVerify, eventUpdateStatus)
 * - Speed up category and city-based searches
 * - Support showcase event queries
 * 
 * Indexes Created:
 * - Single field: createdBy, isActive, isVerify, isShowcaseEvent, city.name, 
 *   experientialEventCategory, eventUpdateStatus
 * - Compound: isActive+category, isActive+city, isActive+showcase, isVerify+updateStatus
 * 
 * All indexes use background:true for non-blocking creation in production.
 */

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection('experientialevents');
    
    console.log('🔨 Creating indexes for experientialevents collection...');
    
    try {
      // Single field indexes
      await collection.createIndex(
        { createdBy: 1 },
        { name: 'idx_createdBy', background: true }
      );
      console.log('  ✅ Created index: idx_createdBy');

      await collection.createIndex(
        { isActive: 1 },
        { name: 'idx_isActive', background: true }
      );
      console.log('  ✅ Created index: idx_isActive');

      await collection.createIndex(
        { isVerify: 1 },
        { name: 'idx_isVerify', background: true }
      );
      console.log('  ✅ Created index: idx_isVerify');

      await collection.createIndex(
        { isShowcaseEvent: 1 },
        { name: 'idx_isShowcaseEvent', background: true, sparse: true }
      );
      console.log('  ✅ Created index: idx_isShowcaseEvent');

      await collection.createIndex(
        { 'city.name': 1 },
        { name: 'idx_city_name', background: true }
      );
      console.log('  ✅ Created index: idx_city_name');

      await collection.createIndex(
        { experientialEventCategory: 1 },
        { name: 'idx_experientialEventCategory', background: true }
      );
      console.log('  ✅ Created index: idx_experientialEventCategory');

      await collection.createIndex(
        { eventUpdateStatus: 1 },
        { name: 'idx_eventUpdateStatus', background: true }
      );
      console.log('  ✅ Created index: idx_eventUpdateStatus');

      // Compound indexes for common query patterns
      await collection.createIndex(
        { isActive: 1, experientialEventCategory: 1 },
        { name: 'idx_active_category', background: true }
      );
      console.log('  ✅ Created compound index: idx_active_category');

      await collection.createIndex(
        { isActive: 1, 'city.name': 1 },
        { name: 'idx_active_city', background: true }
      );
      console.log('  ✅ Created compound index: idx_active_city');

      await collection.createIndex(
        { isActive: 1, isShowcaseEvent: 1 },
        { name: 'idx_active_showcase', background: true }
      );
      console.log('  ✅ Created compound index: idx_active_showcase');

      await collection.createIndex(
        { isVerify: 1, eventUpdateStatus: 1 },
        { name: 'idx_verify_updateStatus', background: true }
      );
      console.log('  ✅ Created compound index: idx_verify_updateStatus');

      console.log('✨ Successfully created all indexes for experientialevents collection');
      
    } catch (error) {
      console.error('❌ Error creating indexes for experientialevents:', error.message);
      throw error;
    }
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection('experientialevents');
    
    console.log('🔄 Rolling back experientialevents indexes...');
    
    try {
      // Drop indexes in reverse order
      const indexesToDrop = [
        'idx_verify_updateStatus',
        'idx_active_showcase',
        'idx_active_city',
        'idx_active_category',
        'idx_eventUpdateStatus',
        'idx_experientialEventCategory',
        'idx_city_name',
        'idx_isShowcaseEvent',
        'idx_isVerify',
        'idx_isActive',
        'idx_createdBy'
      ];

      for (const indexName of indexesToDrop) {
        try {
          await collection.dropIndex(indexName);
          console.log(`  ✅ Dropped index: ${indexName}`);
        } catch (error) {
          // Index might not exist, continue
          console.log(`  ⚠️  Index ${indexName} not found, skipping...`);
        }
      }

      console.log('✨ Successfully rolled back all experientialevents indexes');
      
    } catch (error) {
      console.error('❌ Error rolling back indexes:', error.message);
      throw error;
    }
  }
};
