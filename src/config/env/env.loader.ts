import * as dotenv from 'dotenv';
import * as path from 'path';

// Determine environment file to load
const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, `../../../${envFile}`) });

// Fallback: load .env if key still missing
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = process.env;

console.log(`⚙️ Loaded environment file: ${envFile}`);
