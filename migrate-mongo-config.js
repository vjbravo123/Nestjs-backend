/**
 * Migrate-Mongo Configuration
 * 
 * This configuration file is used by migrate-mongo to run database migrations.
 * Migrations run AUTOMATICALLY on every deployment via Render's preDeployCommand.
 * 
 * How it works:
 * 1. Render runs: npm run migrate:up (defined in package.json)
 * 2. migrate-mongo reads this config file
 * 3. Loads environment-specific .env file (.env.production, .env.qa, or .env.local)
 * 4. Connects to the appropriate MongoDB database
 * 5. Runs pending migrations from the migrations/ directory
 * 
 * Local usage (manual):
 * - npm run migrate:create <name>  - Create new migration
 * - npm run migrate:status         - Check migration status
 * - npm run migrate:up             - Run pending migrations
 * - npm run migrate:down           - Rollback last migration
 * 
 * Environment override:
 * - CHECK_ENV=qa npm run migrate:status    - Check QA migrations
 * - CHECK_ENV=production npm run migrate:up - Run prod migrations (emergency only)
 * 
 * See MIGRATION_GUIDE.md for detailed documentation.
 */

// In this file you can configure migrate-mongo
const dotenv = require('dotenv');
const path = require('path');

// Determine environment file to load
// Use CHECK_ENV for migration-specific environment override, fallback to NODE_ENV
const env = process.env.CHECK_ENV || process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production'
              : env === 'qa' ? '.env.qa'
              : '.env.local';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, envFile) });

console.log(`⚙️ Migrate-mongo using environment: ${env} (${envFile})`);

const config = {
  mongodb: {
    url: process.env.MONGODB_URL,

    options: {
      // Connection options - MongoDB driver 4.x+ doesn't need useNewUrlParser/useUnifiedTopology
    }
  },

  // The migrations dir, can be an relative or absolute path. Only edit this when really necessary.
  migrationsDir: "migrations",

  // The mongodb collection where the applied changes are stored. Only edit this when really necessary.
  changelogCollectionName: "changelog",

  // The mongodb collection where the lock will be created.
  lockCollectionName: "changelog_lock",

  // The value in seconds for the TTL index that will be used for the lock. Value of 0 will disable the feature.
  lockTtl: 0,

  // The file extension to create migrations and search for in migration dir 
  migrationFileExtension: ".js",

  // Enable the algorithm to create a checksum of the file contents and use that in the comparison to determine
  // if the file should be run.  Requires that scripts are coded to be run multiple times.
  useFileHash: false,

  // Don't change this, unless you know what you're doing
  moduleSystem: 'commonjs',
};

module.exports = config;
