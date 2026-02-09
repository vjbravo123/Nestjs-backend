#!/usr/bin/env node

/**
 * Database Health Check Script
 * 
 * This script checks your MongoDB connection and provides a complete report
 * Run: node scripts/check-database.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Determine which environment to check
const env = process.env.CHECK_ENV || 'production';
const envFile = env === 'production' ? '.env.production' 
              : env === 'qa' ? '.env.qa' 
              : '.env.development';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, `../${envFile}`) });

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        ZAPPY EVENTZ - DATABASE HEALTH CHECK               ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log(`📍 Environment: ${env.toUpperCase()}`);
console.log(`📁 Config file: ${envFile}`);
console.log(`🔗 Connecting to: ${process.env.MONGODB_URL?.replace(/\/\/.*@/, '//***:***@')}\n`);

async function checkDatabase() {
  let connection;
  
  try {
    // Connect to MongoDB
    console.log('⏳ Connecting to MongoDB...');
    connection = await mongoose.connect(process.env.MONGODB_URL, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = connection.connection.db;
    
    // 1. Database Statistics
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATABASE STATISTICS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const stats = await db.stats();
    console.log(`Database Name:     ${stats.db}`);
    console.log(`Collections:       ${stats.collections}`);
    console.log(`Data Size:         ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Storage Size:      ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Indexes:           ${stats.indexes}`);
    console.log(`Index Size:        ${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total Documents:   ~${stats.objects}`);
    
    // 2. Collections Overview
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📁 COLLECTIONS & DOCUMENT COUNT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('⚠️  No collections found - database appears empty');
    } else {
      for (const coll of collections) {
        try {
          const count = await db.collection(coll.name).countDocuments();
          const icon = count > 0 ? '📦' : '📭';
          console.log(`${icon} ${coll.name.padEnd(30)} ${count.toLocaleString()} documents`);
        } catch (err) {
          console.log(`❌ ${coll.name.padEnd(30)} Error: ${err.message}`);
        }
      }
    }
    
    // 3. Index Analysis for Critical Collections
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 INDEX ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const criticalCollections = [
      'users',
      'vendors', 
      'orders',
      'cartitems',
      'birthdayevents',
      'experientialevents',
      'coupons'
    ];
    
    const missingIndexes = [];
    
    for (const collName of criticalCollections) {
      try {
        const indexes = await db.collection(collName).indexes();
        console.log(`\n📋 ${collName}:`);
        
        if (indexes.length === 1 && indexes[0].name === '_id_') {
          console.log(`   ⚠️  Only default _id index exists (MISSING CUSTOM INDEXES)`);
          missingIndexes.push(collName);
        } else {
          indexes.forEach(idx => {
            const keys = Object.entries(idx.key)
              .map(([k, v]) => `${k}:${v}`)
              .join(', ');
            const unique = idx.unique ? ' [UNIQUE]' : '';
            const icon = idx.name === '_id_' ? '🔹' : '✅';
            console.log(`   ${icon} ${idx.name}: { ${keys} }${unique}`);
          });
        }
      } catch (err) {
        if (err.message.includes('ns not found')) {
          console.log(`\n📋 ${collName}:`);
          console.log(`   ℹ️  Collection doesn't exist yet`);
        } else {
          console.log(`\n📋 ${collName}:`);
          console.log(`   ❌ Error: ${err.message}`);
        }
      }
    }
    
    // 4. Migration Status
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📜 MIGRATION STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const migrations = await db.collection('migrations_changelog')
        .find()
        .sort({ appliedAt: -1 })
        .toArray();
      
      if (migrations.length === 0) {
        console.log('⚠️  No migrations applied yet');
        console.log('💡 Run: npm run migrate:up');
      } else {
        console.log(`✅ ${migrations.length} migration(s) applied:\n`);
        migrations.forEach((m, idx) => {
          const date = new Date(m.appliedAt).toLocaleString();
          console.log(`   ${idx + 1}. ${m.fileName}`);
          console.log(`      Applied: ${date}`);
        });
      }
    } catch (err) {
      console.log('ℹ️  Migration tracking not set up');
      console.log('💡 Install: npm install migrate-mongo --save-dev');
    }
    
    // 5. Recommendations
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 RECOMMENDATIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const recommendations = [];
    
    if (stats.collections === 0) {
      recommendations.push('🔴 Database is empty - run app to create collections');
    }
    
    if (missingIndexes.length > 0) {
      recommendations.push(`🔴 CRITICAL: ${missingIndexes.length} collection(s) missing indexes:`);
      missingIndexes.forEach(coll => {
        recommendations.push(`   - ${coll}: Create indexes via migration`);
      });
    }
    
    if (stats.indexes <= stats.collections) {
      recommendations.push('🟡 Very few indexes detected - queries will be slow');
      recommendations.push('   Action: Run initial migration to create indexes');
    }
    
    try {
      const hasAutoIndex = await db.collection('users').findOne();
      if (hasAutoIndex && missingIndexes.length > 0) {
        recommendations.push('🟡 autoIndex might be enabled - disable in production');
        recommendations.push('   Check: src/config/database/mongoose.config.ts');
      }
    } catch (err) {
      // Collection doesn't exist
    }
    
    if (recommendations.length === 0) {
      console.log('✅ Database looks healthy!');
    } else {
      recommendations.forEach(rec => console.log(rec));
    }
    
    // 6. Next Steps
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 NEXT STEPS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (missingIndexes.length > 0) {
      console.log('\n1. Install migration tool:');
      console.log('   npm install migrate-mongo --save-dev\n');
      
      console.log('2. Initialize migrations:');
      console.log('   npx migrate-mongo init\n');
      
      console.log('3. Create index migration:');
      console.log('   npm run migrate:create create-initial-indexes\n');
      
      console.log('4. Run migration:');
      console.log(`   CHECK_ENV=${env} npm run migrate:up\n`);
    } else {
      console.log('\n✅ Database is production-ready!\n');
      console.log('Optional improvements:');
      console.log('   - Set up automated backups in MongoDB Atlas');
      console.log('   - Configure connection pooling');
      console.log('   - Enable monitoring alerts');
    }
    
  } catch (error) {
    console.log('\n❌ ERROR:', error.message);
    
    if (error.message.includes('authentication')) {
      console.log('\n🔒 Authentication failed - check credentials in ' + envFile);
    } else if (error.message.includes('timeout')) {
      console.log('\n⏱️  Connection timeout - check network/firewall');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('\n🌐 DNS resolution failed - check connection string');
    }
    
    process.exit(1);
    
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from database');
    }
  }
}

// Run the check
checkDatabase()
  .then(() => {
    console.log('\n✅ Health check complete!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Health check failed:', err.message);
    process.exit(1);
  });
