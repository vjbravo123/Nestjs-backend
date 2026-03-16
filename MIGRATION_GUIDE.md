# Database Migration Guide - Render Automation

## Overview

This project uses **Render's automatic pre-deploy migrations** with `migrate-mongo` for database schema changes:

- ✅ **Automatic migrations** on every deployment (dev/qa/prod)
- ✅ Environment-specific configurations (.env.production, .env.qa, .env.local)
- ✅ Zero-downtime deployments with Render
- ✅ Migration tracking and audit trail via MongoDB changelog
- ℹ️ **Backups:** Separate daily Render Cron Jobs (not tied to migrations)
- ✅ Rollback capability for emergency scenarios

## How It Works

### Render Automation (Primary Method)

**All migrations run automatically** when you deploy to Render via `preDeployCommand`:

```yaml
# render.yaml
services:
  - type: web
    preDeployCommand: npm run migrate:up  # ← Migrations run automatically here
    startCommand: npm run start:prod
```

**Workflow:**
1. Developer creates migration locally
2. Tests migration on local dev database
3. Commits migration file to git
4. Pushes to dev/qa/main branch
5. **Render automatically runs migration** before deploying new code
6. Application starts with updated schema

**No manual intervention required for 99% of deployments!**

## Quick Start

### 1. Creating a New Migration

```bash
# Create migration file with descriptive name
npm run migrate:create add-user-indexes

# This creates: migrations/YYYYMMDDHHMMSS-add-user-indexes.js
```

### 2. Write Migration Code

```javascript
module.exports = {
  async up(db, client) {
    // Apply changes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1, active: 1 });
    
    console.log('✅ Created user indexes');
  },

  async down(db, client) {
    // Rollback changes (for emergencies)
    await db.collection('users').dropIndex('email_1');
    await db.collection('users').dropIndex('role_1_active_1');
    
    console.log('✅ Dropped user indexes');
  }
};
```

### 3. Test Locally

```bash
# Check current migration status
npm run migrate:status

# Run migration on local dev database
npm run migrate:up

# Verify it worked (check your local DB)
# Test rollback if needed
npm run migrate:down

# Re-run to confirm idempotency
npm run migrate:up
```

### 4. Deploy!

```bash
# Commit the migration file
git add migrations/
git commit -m "feat: add user indexes migration"

# Push to your branch
git push origin dev        # auto-deploys to dev environment
git push origin qa         # auto-deploys to qa environment  
git push origin main       # auto-deploys to production

# Render will:
# 1. Pull latest code
# 2. Run npm install
# 3. Run npm run migrate:up  ← Your migration runs here
# 4. Build the application
# 5. Start the new version
```

**That's it!** Render handles the rest automatically.

## Environment Configuration

Migrations automatically use the correct database for each environment:

| Environment | Branch | Database Source | Config File |
|-------------|--------|-----------------|-------------|
| Development | dev    | .env.local      | Local MongoDB or Atlas |
| QA/Staging  | qa     | .env.qa         | Atlas QA cluster |
| Production  | main   | .env.production | Atlas production cluster |

Environment detection happens in `migrate-mongo-config.js`:

```javascript
const env = process.env.CHECK_ENV || process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production'
              : env === 'qa' ? '.env.qa'
              : '.env.local';
```

## Migration Examples

### Adding Indexes
```javascript
async up(db, client) {
  // Single field index
  await db.collection('orders').createIndex({ userId: 1 });
  
  // Compound index
  await db.collection('orders').createIndex({ userId: 1, status: 1 });
  
  // Unique index with sparse option
  await db.collection('vendors').createIndex(
    { email: 1 }, 
    { unique: true, sparse: true }
  );
  
  console.log('✅ Created order and vendor indexes');
}
```

### Updating Documents
```javascript
async up(db, client) {
  // Add default value to existing documents
  const result = await db.collection('users').updateMany(
    { role: { $exists: false } },
    { $set: { role: 'user', active: true } }
  );
  
  console.log(`✅ Updated ${result.modifiedCount} users with default role`);
}
```

### Creating Collections
```javascript
async up(db, client) {
  await db.createCollection('notifications', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'message', 'type'],
        properties: {
          userId: { bsonType: 'objectId' },
          message: { bsonType: 'string' },
          type: { enum: ['email', 'sms', 'push'] },
          read: { bsonType: 'bool' }
        }
      }
    }
  });
  
  console.log('✅ Created notifications collection with schema validation');
}
```

### Data Migration
```javascript
async up(db, client) {
  // Migrate data from old structure to new
  const users = await db.collection('users').find({ profile: { $exists: true } }).toArray();
  
  for (const user of users) {
    await db.collection('user_profiles').insertOne({
      userId: user._id,
      ...user.profile,
      migratedAt: new Date()
    });
  }
  
  // Remove old field
  await db.collection('users').updateMany(
    {},
    { $unset: { profile: '' } }
  );
  
  console.log(`✅ Migrated ${users.length} user profiles`);
}
```

## Monitoring Migrations

### Check Migration Status

```bash
# Local development
npm run migrate:status

# Output:
# ┌────────────────────────────────────────────┬────────────────────┐
# │ Filename                                    │ Applied At         │
# ├────────────────────────────────────────────┼────────────────────┤
# │ 20260209180538-add-birthdayevents-indexes  │ 2026-02-09 18:12:43│
# │ 20260209183029-add-experientialevents-inde │ 2026-02-09 18:33:15│
# └────────────────────────────────────────────┴────────────────────┘
```

### View Migration History in MongoDB

```javascript
// In MongoDB Atlas or mongo shell
db.changelog.find().sort({ appliedAt: -1 })

// Shows:
// - fileName: migration file name
// - appliedAt: timestamp when migration ran
// - checksum: file hash for integrity
```

### Monitor Render Deployments

1. Go to Render Dashboard → Your Service
2. Click on the deployment in the Events tab
3. View "Pre-Deploy" logs to see migration output
4. Look for "✅ Created indexes" or migration-specific logs

## Emergency Procedures

### Manual Migration (Emergency Only)

**⚠️ Only use when necessary** (deployment rollback, hotfix, etc.)

```bash
# Development (safe, use anytime)
node scripts/safe-migrate.js

# Production (emergency only, requires typing confirmation)
CHECK_ENV=production node scripts/safe-migrate.js
# You'll be prompted to type: "CONFIRM PRODUCTION MIGRATION"
```

The `safe-migrate.js` script:
1. Shows migration status
2. Runs pending migrations
3. Provides confirmation for production

**Note:** Backups are handled separately by Render Cron Jobs (see Backup & Recovery section)

### Rollback a Migration

**Option 1: Create a new "undo" migration** (recommended)

```bash
# Create new migration to reverse changes
npm run migrate:create undo-problematic-change

# In the migration file, write code to reverse the change
# Commit and deploy normally
```

**Option 2: Manual rollback** (emergency only)

```bash
# Rollback last migration locally
npm run migrate:down

# For production, restore from backup:
# 1. Check Render Cron Job logs for latest backup
# 2. Download backup from S3 (see backup script configuration)
# 3. Contact team lead before restoring
```

### Migration Failed During Deployment

**If Render deployment fails due to migration error:**

1. **Check Render logs:**
   - Dashboard → Service → Failed Deployment → Pre-Deploy logs
   - Look for error message from migration

2. **Fix the issue:**
   ```bash
   # Fix the migration file locally
   # Test thoroughly
   npm run migrate:down  # if migration partially applied
   npm run migrate:up    # test the fix
   ```

3. **Deploy the fix:**
   ```bash
   git add migrations/
   git commit -m "fix: correct migration error"
   git push
   ```

4. **Render will retry:**
   - Automatic retry on the next deployment
   - Migration system tracks what has already run
   - Only new/pending migrations execute

### Database Lock Issues

If migration appears stuck:

```bash
# Check lock collection
db.changelog_lock.find()

# If lock is stale (check timestamp), remove it manually:
db.changelog_lock.deleteMany({})

# Then retry deployment or run migration locally
```

## Best Practices

### ✅ DO

- **Test locally first** - Always run migrations on dev database before committing
- **Keep migrations small** - One logical change per migration
- **Make them idempotent** - Safe to run multiple times (use `createIndexes` with `ifNotExists`, etc.)
- **Write descriptive names** - `add-user-email-index` not `update-db`
- **Add logging** - Use `console.log()` to track progress
- **Write down() functions** - Enable rollback capability
- **Commit migration files** - Essential for team coordination
- **Use transactions** - When available (MongoDB 4.0+ replica sets)

```javascript
async up(db, client) {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection('orders').updateMany({}, { $set: { version: 2 } }, { session });
      await db.collection('payments').updateMany({}, { $set: { version: 2 } }, { session });
    });
  } finally {
    await session.endSession();
  }
}
```

### ❌ DON'T

- **Don't modify applied migrations** - Create new migrations instead
- **Don't delete migration files** - They're part of the audit trail
- **Don't skip environments** - Test: dev → qa → prod
- **Don't make destructive changes without backups** - Check backup logs first
- **Don't run manual prod migrations casually** - Use automated deployment
- **Don't commit untested migrations** - Test locally first

## Troubleshooting

### Problem: "Migration already applied"

**Cause:** Trying to run a migration that's already in the changelog

**Solution:**
```bash
# Check what's been applied
npm run migrate:status

# If you need to re-run (rare):
# 1. Remove from changelog collection
db.changelog.deleteOne({ fileName: '20260209180538-add-birthdayevents-indexes.js' })

# 2. Re-run
npm run migrate:up
```

### Problem: "Connection timeout / MONGODB_URL not set"

**Cause:** Environment variables not loaded correctly

**Solution:**
```bash
# Verify .env file exists and has correct content
cat .env.local          # Linux/Mac
Get-Content .env.local  # Windows

# Should contain:
# MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Test connection
npm run db:check
```

### Problem: "Migration file not found"

**Cause:** Migration file not committed to git or not in migrations/ directory

**Solution:**
```bash
# Verify migration exists
ls migrations/

# If missing, create it again or restore from git history
git log -- migrations/
git checkout <commit-hash> -- migrations/20260209180538-add-birthdayevents-indexes.js

# Commit if needed
git add migrations/
git commit -m "fix: restore missing migration file"
```

## Backup & Recovery

### Automated Backups (Separate from Migrations)

**Important:** Database backups are **NOT** automatically created before migrations. Backups run on a separate schedule via Render Cron Jobs.

Daily backups run automatically via Render Cron Jobs:

- **Schedule:** 2:00 AM UTC daily (all environments)
- **Storage:** AWS S3 with 7-day retention
- **Format:** Compressed JSON (collection.json.gz)
- **Script:** `scripts/backup-database.js`
- **Independent:** Runs separately from deployment/migration process

**Verify backups:**
1. Render Dashboard → Cron Jobs → `zappy-backup-*` services
2. Check logs for "✅ Backup completed successfully"
3. Verify S3 bucket contains recent files
4. Latest backup is always within 24 hours

### Running Backups Locally

**For development/testing purposes**, you can run the backup script on your local machine:

#### Prerequisites

Ensure your `.env.local` file has these AWS credentials:

```bash
# MongoDB connection
MONGODB_URL=mongodb+srv://your-credentials@cluster.mongodb.net/dbname

# AWS S3 credentials (for backup storage)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=your-backup-bucket-name
```

#### Run Local Backup

```bash
# Backup development database to S3
node scripts/backup-database.js

# Output:
# 📦 Starting database backup...
# 🔧 Environment: development
# 📊 Backing up collection: users (1250 documents)
# 📊 Backing up collection: orders (3421 documents)
# ...
# ✅ Backup completed successfully
# 📍 Location: s3://bucket/backups/development/2026-02-16-14-30-00/
```

#### Backup Different Environments

```bash
# Backup QA environment
CHECK_ENV=qa node scripts/backup-database.js

# Backup production (requires production AWS credentials)
CHECK_ENV=production node scripts/backup-database.js
```

**Note:** 
- Local backups upload directly to S3 (same as Render cron jobs)
- You need appropriate AWS IAM permissions to write to the S3 bucket
- Backups follow the same retention policy (7 days)
- File format: `backups/{environment}/{timestamp}/{collection}.json.gz`

#### Verify Local Backup

```bash
# List backups in S3
aws s3 ls s3://your-bucket/backups/development/ --recursive

# Download and inspect a backup
aws s3 cp s3://your-bucket/backups/development/2026-02-16-14-30-00/users.json.gz ./
gunzip users.json.gz
cat users.json  # View the backup data
```

### Manual Backup (Before Risky Migration)

**When to use:** If you need a backup immediately before a complex migration (beyond the daily automated backup).

```bash
# Run backup script manually
node scripts/backup-database.js

# For specific environment
CHECK_ENV=production node scripts/backup-database.js

# Backup saved to S3 with timestamp
# Format: backups/{environment}/YYYY-MM-DD-HH-MM-SS/
```

**Note:** This is rarely needed since daily automated backups already provide recovery points. Use only for:
- Major schema changes
- Destructive data migrations
- When you need a backup within the last 24 hours

### Restore from Backup

```bash
# 1. Download backup from S3 (via AWS Console or CLI)
aws s3 cp s3://your-bucket/backups/production/2026-02-09-02-00-00/ ./restore/ --recursive

# 2. Decompress files
gunzip ./restore/*.gz

# 3. Import to MongoDB
# (Contact team lead or DevOps before restoring production)
mongoimport --uri="$MONGODB_URL" --collection=users --file=./restore/users.json --jsonArray
mongoimport --uri="$MONGODB_URL" --collection=orders --file=./restore/orders.json --jsonArray
# Repeat for all collections

# 4. Verify restoration
npm run db:check
```

## Deployment Workflow Summary

```
┌─────────────────────────────────────────────────────────────┐
│  Developer Workflow                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Create migration locally                                │
│     npm run migrate:create add-feature                      │
│                                                             │
│  2. Write migration code                                    │
│     migrations/YYYYMMDDHHMMSS-add-feature.js                │
│                                                             │
│  3. Test on local database                                  │
│     npm run migrate:up                                      │
│     npm run migrate:status                                  │
│                                                             │
│  4. Commit and push                                         │
│     git add migrations/                                     │
│     git commit -m "feat: add feature migration"             │
│     git push origin dev                                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Render Automated Workflow                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  5. Render detects push                                     │
│     ↓                                                       │
│  6. Pulls latest code                                       │
│     ↓                                                       │
│  7. Runs npm install                                        │
│     ↓                                                       │
│  8. Runs npm run migrate:up  ← MIGRATION RUNS HERE          │
│     ↓                                                       │
│  9. Builds application (npm run build)                      │
│     ↓                                                       │
│  10. Deploys new version                                    │
│     ↓                                                       │
│  11. Health check passes                                    │
│     ↓                                                       │
│  12. ✅ Deployment complete!                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Files & Configuration

### Key Files

- **`migrations/`** - All migration files (never delete!)
- **`migrate-mongo-config.js`** - Environment configuration
- **`scripts/safe-migrate.js`** - Emergency manual migration script
- **`render.yaml`** - Render deployment configuration with `preDeployCommand`
- **`.env.production`**, **`.env.qa`**, **`.env.local`** - Database connection strings

### Package.json Scripts

```json
{
  "migrate:create": "migrate-mongo create",      // Create new migration
  "migrate:up": "migrate-mongo up",              // Run pending migrations
  "migrate:down": "migrate-mongo down",          // Rollback last migration
  "migrate:status": "migrate-mongo status"       // Show migration status
}
```

**Note:** Environment-specific scripts removed (`migrate:up:qa`, `migrate:up:prod`) because Render handles deployment automatically.

## Support

For migration issues:

1. **Check Render deployment logs** (Dashboard → Service → Events → Pre-Deploy)
2. **Verify migration file is committed** (`git log -- migrations/`)
3. **Test locally first** (`npm run migrate:up`)
4. **Check database connection** (`npm run db:check`)
5. **Review this guide** for common solutions
6. **Contact team lead** for production issues

## Migration History

Current migrations:
- `20260209180538-add-birthdayevents-indexes.js` - 7 indexes for birthday events
- `20260209183029-add-experientialevents-indexes.js` - 11 indexes for experiential events

All migrations tracked in MongoDB `changelog` collection.
