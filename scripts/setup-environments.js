#!/usr/bin/env node

/**
 * Environment Setup Script
 * 
 * Creates QA database and validates all environments
 * Run: node scripts/setup-environments.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        ZAPPY EVENTZ - ENVIRONMENT SETUP                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const environments = ['development', 'production'];

async function testEnvironment(env) {
  const envFile = env === 'production' ? '.env.production' 
                : env === 'qa' ? '.env.qa'
                : '.env.development';
  
  const envPath = path.resolve(__dirname, `../${envFile}`);
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Testing: ${env.toUpperCase()} (${envFile})`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Load env file
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.log(`❌ File not found: ${envFile}`);
    return { env, status: 'missing', error: 'File not found' };
  }
  
  console.log(`✅ File exists: ${envFile}`);
  
  // Check required variables
  const required = [
    'NODE_ENV',
    'MONGODB_URL',
    'JWT_SECRET',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET'
  ];
  
  const missing = [];
  const present = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    } else {
      present.push(key);
    }
  }
  
  if (missing.length > 0) {
    console.log(`\n⚠️  Missing variables: ${missing.join(', ')}`);
  }
  
  console.log(`\n📋 Configuration:`);
  console.log(`   NODE_ENV:      ${process.env.NODE_ENV || 'NOT SET'}`);
  console.log(`   PORT:          ${process.env.PORT || '3000'}`);
  console.log(`   JWT_SECRET:    ${process.env.JWT_SECRET ? '✓ Set' : '✗ Missing'}`);
  console.log(`   AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET || 'NOT SET'}`);
  
  // Test MongoDB connection
  if (process.env.MONGODB_URL) {
    const safeUrl = process.env.MONGODB_URL.replace(/\/\/.*@/, '//***:***@');
    console.log(`\n🔗 MongoDB URL: ${safeUrl}`);
    
    try {
      console.log('⏳ Testing connection...');
      const conn = await mongoose.connect(process.env.MONGODB_URL, {
        serverSelectionTimeoutMS: 5000,
      });
      
      const dbName = conn.connection.db.databaseName;
      const stats = await conn.connection.db.stats();
      
      console.log(`✅ Connected to: ${dbName}`);
      console.log(`   Collections: ${stats.collections}`);
      console.log(`   Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
      
      await mongoose.disconnect();
      
      return { 
        env, 
        status: 'ok', 
        database: dbName,
        collections: stats.collections,
        size: stats.dataSize
      };
      
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      return { env, status: 'connection_failed', error: error.message };
    }
  } else {
    console.log(`❌ MONGODB_URL not set`);
    return { env, status: 'no_url' };
  }
}

async function main() {
  const results = [];
  
  for (const env of environments) {
    const result = await testEnvironment(env);
    results.push(result);
    
    // Clear environment between tests
    Object.keys(process.env).forEach(key => {
      if (!key.startsWith('npm_') && !key.startsWith('NODE_')) {
        delete process.env[key];
      }
    });
  }
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  results.forEach(r => {
    const icon = r.status === 'ok' ? '✅' : '❌';
    const statusText = r.status === 'ok' 
      ? `Connected to ${r.database} (${r.collections} collections)`
      : r.status;
    
    console.log(`${icon} ${r.env.toUpperCase().padEnd(15)} ${statusText}`);
  });
  
  const allOk = results.every(r => r.status === 'ok');
  
  if (allOk) {
    console.log('\n✅ All environments configured correctly!\n');
  } else {
    console.log('\n⚠️  Some environments need attention:\n');
    
    results
      .filter(r => r.status !== 'ok')
      .forEach(r => {
        console.log(`❌ ${r.env}: ${r.error || r.status}`);
      });
    
    console.log('\n💡 Next steps:');
    console.log('   1. Create missing .env files');
    console.log('   2. Fill in MongoDB connection strings');
    console.log('   3. Run this script again to verify\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
