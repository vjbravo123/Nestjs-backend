export interface EnvConfig {
  NODE_ENV: string;
  MONGODB_URL: string;
  PORT: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGIN: string;
  LOG_LEVEL: string;
  RATE_LIMIT_WINDOW: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_S3_BUCKET: string;
  REDIS_URL?: string;
  REDIS_HOST: string;
  REDIS_PORT: string;
  REDIS_PASSWORD?: string;
  MSG91_AUTH_KEY: string;
}
