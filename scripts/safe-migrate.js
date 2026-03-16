/**
 * EMERGENCY MANUAL MIGRATION SCRIPT
 * 
 * ⚠️ WARNING: This script is for EMERGENCY USE ONLY
 * 
 * NORMAL OPERATION:
 * - Migrations run automatically via Render's preDeployCommand on each deployment
 * - See render.yaml for configuration
 * - No manual intervention needed for regular deployments
 * 
 * USE THIS SCRIPT ONLY WHEN:
 * - Emergency hotfix migration needed outside deployment cycle
 * - Rollback required due to critical issue
 * - Testing migration locally before committing
 * 
 * USAGE:
 * - Development: node scripts/safe-migrate.js
 * - QA: CHECK_ENV=qa node scripts/safe-migrate.js
 * - Production: CHECK_ENV=production node scripts/safe-migrate.js (requires confirmation)
 * 
 * This script provides:
 * - Environment-specific validation
 * - Production safety confirmation
 * - Migration status checks
 * 
 * Note: Database backups run separately via Render Cron Jobs.
 * If you need a backup before migration, run: node scripts/backup-database.js
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const env = process.env.CHECK_ENV || process.env.NODE_ENV || 'development';

console.log('╔════════════════════════════════════════════════════╗');
console.log('║       SAFE MIGRATION - Production Grade           ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log();
console.log(`🔧 Environment: ${env.toUpperCase()}`);
console.log();

if (env === 'production') {
  console.log('⚠️  WARNING: You are about to run migrations on PRODUCTION!');
  console.log();
  
  rl.question('Type "CONFIRM PRODUCTION MIGRATION" to proceed: ', (answer) => {
    if (answer !== 'CONFIRM PRODUCTION MIGRATION') {
      console.log('❌ Migration cancelled');
      rl.close();
      process.exit(0);
    }
    
    runMigration();
  });
} else {
  runMigration();
}

function runMigration() {
  try {
    console.log();
    console.log('ℹ️  Note: Database backups run separately via Render Cron Jobs (daily at 2 AM UTC)');
    console.log('ℹ️  If you need a backup NOW, run: node scripts/backup-database.js');
    console.log();
    
    console.log('🔍 Step 1/2: Checking migration status...');
    execSync('npm run migrate:status', { stdio: 'inherit' });
    
    console.log();
    console.log('⚡ Step 2/2: Running migrations...');
    execSync('npm run migrate:up', { stdio: 'inherit' });
    
    console.log();
    console.log('✅ Migration completed successfully!');
    console.log();
    
    if (rl) rl.close();
    process.exit(0);
  } catch (error) {
    console.error();
    console.error('❌ Migration failed!');
    console.error('💡 Tip: Restore from latest automated backup or run manual backup script');
    console.error();
    
    if (rl) rl.close();
    process.exit(1);
  }
}
