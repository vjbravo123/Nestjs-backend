import * as dotenv from 'dotenv';
import * as path from 'path';
import logger from '../../common/utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

interface EnvVar {
  key: string;
  required?: boolean;
  defaultValue?: string | number;
  description: string;
}

// ALL ENV VARIABLES FROM YOUR .env FILE
const requiredEnvVars: EnvVar[] = [
  // Environment
  {
    key: 'NODE_ENV',
    defaultValue: 'development',
    description: 'Application Environment',
  },
  { key: 'PORT', defaultValue: '3000', description: 'Server Port' },
  { key: 'LOG_LEVEL', defaultValue: 'info', description: 'Log Level' },
  {
    key: 'LOG_FILE_PATH',
    defaultValue: 'logs',
    description: 'Directory for logs',
  },

  // Security
  { key: 'JWT_SECRET', required: true, description: 'JWT Secret Key' },
  {
    key: 'BCRYPT_SALT_ROUNDS',
    defaultValue: '12',
    description: 'BCrypt salt rounds',
  },

  // Database
  { key: 'MONGODB_URL', required: true, description: 'MongoDB Connection URI' },

  // AWS
  { key: 'AWS_ACCESS_KEY_ID', required: true, description: 'AWS Access Key' },
  {
    key: 'AWS_SECRET_ACCESS_KEY',
    required: true,
    description: 'AWS Secret Access Key',
  },
  { key: 'AWS_REGION', required: true, description: 'AWS Region' },
  { key: 'AWS_S3_BUCKET', required: true, description: 'AWS S3 Bucket Name' },

  // Redis
  { key: 'REDIS_HOST', required: true, description: 'Redis Host' },
  { key: 'REDIS_PORT', defaultValue: '6379', description: 'Redis Port' },
  {
    key: 'REDIS_PASSWORD',
    required: false,
    description: 'Redis Password (optional)',
  },

  // MSG91 SMS
  { key: 'MSG91_AUTH_KEY', required: true, description: 'MSG91 SMS API Key' },
  {
    key: 'MSG91_INTEGRATED_NUMBER',
    required: true,
    description: 'MSG91 Integrated Number',
  },
  {
    key: 'MSG91_NAMESPACE',
    required: true,
    description: 'MSG91 Namespace for Template',
  },

  // MSG91 WhatsApp
  {
    key: 'MSG91_TEMPLATE_NAMESPACE',
    required: true,
    description: 'MSG91 WhatsApp Template Namespace',
  },
  {
    key: 'ADMIN_WHATSAPP_NUMBER',
    required: true,
    description: 'Admin WhatsApp Number',
  },

  // MSG91 Email
  { key: 'MSG91_AUTHKEY', required: true, description: 'MSG91 Email Auth Key' },
  {
    key: 'MSG91_EMAIL_DOMAIN',
    required: true,
    description: 'MSG91 Email Domain',
  },
  {
    key: 'MSG91_FROM_EMAIL',
    required: true,
    description: 'MSG91 Sender Email',
  },

  {
    key: 'MAIL_HOST',
    required: false,
    description: 'SMTP Host (optional, MSG91 is primary)',
  },
  {
    key: 'MAIL_PORT',
    required: false,
    description: 'SMTP Port (optional, MSG91 is primary)',
  },
  {
    key: 'MAIL_USER',
    required: false,
    description: 'SMTP Username (optional, MSG91 is primary)',
  },
  {
    key: 'MAIL_PASS',
    required: false,
    description: 'SMTP Password (optional, MSG91 is primary)',
  },
  {
    key: 'MAIL_FROM',
    required: false,
    description: 'SMTP From Email (optional, MSG91 is primary)',
  },
];

export function validateEnvVariables(): void {
  logger.info('🔍 Validating environment variables...');

  const missingVars: string[] = [];
  const defaultsApplied: string[] = [];

  requiredEnvVars.forEach(({ key, required, defaultValue, description }) => {
    if (!process.env[key] || process.env[key]?.trim() === '') {
      if (required) {
        missingVars.push(`${key} (${description})`);
      } else if (defaultValue !== undefined) {
        process.env[key] = String(defaultValue);
        defaultsApplied.push(`${key}=${defaultValue}`);
      }
    }
  });

  if (missingVars.length > 0) {
    logger.error('❌ Missing Required Environment Variables:');
    missingVars.forEach((err) => logger.error(`   → ${err}`));
    throw new Error(
      'Environment validation failed. Fix the missing variables above.',
    );
  }

  if (defaultsApplied.length > 0) {
    logger.warn('⚠️ Defaults applied:');
    defaultsApplied.forEach((def) => logger.warn(`   → ${def}`));
  }

  logger.info('✅ Environment validation successful.');
}
