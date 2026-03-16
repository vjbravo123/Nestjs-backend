/**
 * Migration: Add indexes to birthdayevents collection
 * 
 * This migration creates optimized indexes for the birthdayevents collection
 * to improve query performance for common access patterns:
 * - Age group filtering
 * - Active status filtering
 * - Showcase event filtering
 * - Location-based queries
 * - Compound queries for active events by age group and city
 */

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    console.log('🔨 Creating indexes for birthdayevents collection...');
    
    const collection = db.collection('birthdayevents');
    
    // Single field indexes
    await collection.createIndex({ ageGroup: 1 }, { 
      name: 'idx_ageGroup',
      background: true 
    });
    console.log('  ✅ Created index: idx_ageGroup');
    
    await collection.createIndex({ active: 1 }, { 
      name: 'idx_active',
      background: true 
    });
    console.log('  ✅ Created index: idx_active');
    
    await collection.createIndex({ isShowcaseEvent: 1 }, { 
      name: 'idx_isShowcaseEvent',
      background: true,
      sparse: true  // Only index documents where this field exists
    });
    console.log('  ✅ Created index: idx_isShowcaseEvent');
    
    await collection.createIndex({ 'city.name': 1 }, { 
      name: 'idx_city_name',
      background: true 
    });
    console.log('  ✅ Created index: idx_city_name');
    
    // Compound indexes for common query patterns
    await collection.createIndex(
      { active: 1, ageGroup: 1 }, 
      { 
        name: 'idx_active_ageGroup',
        background: true 
      }
    );
    console.log('  ✅ Created compound index: idx_active_ageGroup');
    
    await collection.createIndex(
      { active: 1, 'city.name': 1 }, 
      { 
        name: 'idx_active_city',
        background: true 
      }
    );
    console.log('  ✅ Created compound index: idx_active_city');
    
    await collection.createIndex(
      { active: 1, isShowcaseEvent: 1 }, 
      { 
        name: 'idx_active_showcase',
        background: true,
        sparse: true
      }
    );
    console.log('  ✅ Created compound index: idx_active_showcase');
    
    console.log('✨ Successfully created all indexes for birthdayevents collection');
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    console.log('🔨 Rolling back: Dropping indexes from birthdayevents collection...');
    
    const collection = db.collection('birthdayevents');
    
    // Drop all indexes created in up() migration
    await collection.dropIndex('idx_ageGroup');
    console.log('  ✅ Dropped index: idx_ageGroup');
    
    await collection.dropIndex('idx_active');
    console.log('  ✅ Dropped index: idx_active');
    
    await collection.dropIndex('idx_isShowcaseEvent');
    console.log('  ✅ Dropped index: idx_isShowcaseEvent');
    
    await collection.dropIndex('idx_city_name');
    console.log('  ✅ Dropped index: idx_city_name');
    
    await collection.dropIndex('idx_active_ageGroup');
    console.log('  ✅ Dropped compound index: idx_active_ageGroup');
    
    await collection.dropIndex('idx_active_city');
    console.log('  ✅ Dropped compound index: idx_active_city');
    
    await collection.dropIndex('idx_active_showcase');
    console.log('  ✅ Dropped compound index: idx_active_showcase');
    
    console.log('✨ Successfully rolled back all indexes for birthdayevents collection');
  }
};
