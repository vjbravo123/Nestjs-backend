const { MongoClient } = require('mongodb');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');

// Determine environment
const env = process.env.CHECK_ENV || process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production'
              : env === 'qa' ? '.env.qa'
              : '.env.local';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const MONGODB_URL = process.env.MONGODB_URL;
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

console.log(`📦 Creating MongoDB backup for ${env} environment...`);
console.log(`☁️  Backup will be uploaded to S3: ${AWS_S3_BUCKET}`);

async function backupDatabase() {
  let client;
  
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URL);
    await client.connect();
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    
    console.log(`📋 Found ${collections.length} collections to backup`);
    
    // Initialize S3 client
    const s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    let totalSize = 0;
    const backupPrefix = `backups/${env}/${timestamp}`;
    
    // Backup each collection
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`   Backing up: ${collectionName}...`);
      
      const collection = db.collection(collectionName);
      const documents = await collection.find({}).toArray();
      
      // Create JSON backup
      const backupData = JSON.stringify({
        collection: collectionName,
        timestamp: new Date().toISOString(),
        environment: env,
        count: documents.length,
        documents: documents,
      }, null, 2);
      
      // Compress and upload to S3
      const fileName = `${backupPrefix}/${collectionName}.json.gz`;
      const compressed = await compressData(backupData);
      
      await s3Client.send(new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: fileName,
        Body: compressed,
        ContentType: 'application/gzip',
        Metadata: {
          environment: env,
          collection: collectionName,
          documentCount: documents.length.toString(),
          backupDate: new Date().toISOString(),
        },
      }));
      
      const compressedSize = compressed.length / (1024 * 1024);
      totalSize += compressedSize;
      console.log(`      ✓ ${documents.length} documents (${compressedSize.toFixed(2)} MB compressed)`);
    }
    
    console.log(`✅ Backup completed successfully`);
    console.log(`💾 Total size: ${totalSize.toFixed(2)} MB (compressed)`);
    console.log(`📍 S3 location: s3://${AWS_S3_BUCKET}/${backupPrefix}/`);
    
    // Clean up old backups (keep last 7 days)
    await cleanupOldBackups(s3Client, AWS_S3_BUCKET, env, 7);
    
    await client.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    if (client) await client.close();
    process.exit(1);
  }
}

async function compressData(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const gzip = createGzip();
    
    gzip.on('data', chunk => chunks.push(chunk));
    gzip.on('end', () => resolve(Buffer.concat(chunks)));
    gzip.on('error', reject);
    
    gzip.write(data);
    gzip.end();
  });
}

async function cleanupOldBackups(s3Client, bucket, environment, keepDays) {
  try {
    const prefix = `backups/${environment}/`;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    
    console.log(`🧹 Cleaning up backups older than ${keepDays} days...`);
    
    const listResponse = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    }));
    
    if (!listResponse.Contents) {
      console.log('   No old backups to clean up');
      return;
    }
    
    const oldBackups = listResponse.Contents.filter(obj => {
      return new Date(obj.LastModified) < cutoffDate;
    });
    
    if (oldBackups.length === 0) {
      console.log('   No old backups to clean up');
      return;
    }
    
    console.log(`   Deleting ${oldBackups.length} old backup files...`);
    for (const obj of oldBackups) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: obj.Key,
      }));
    }
    
    console.log(`   ✓ Cleanup completed`);
  } catch (error) {
    console.warn('⚠️  Cleanup warning:', error.message);
  }
}

// Run backup
backupDatabase();
