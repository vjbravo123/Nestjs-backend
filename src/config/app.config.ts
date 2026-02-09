export default () => ({
  env: process.env.NODE_ENV,
  port: Number(process.env.PORT) || 3000,

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || 'logs',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  bcrypt: {
    saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  },

  mongo: {
    uri: process.env.MONGODB_URL,
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET,
  },

  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
  },

  // MSG91 PROVIDERS
  msg91: {
    sms: {
      authKey: process.env.MSG91_AUTH_KEY,
      integratedNumber: process.env.MSG91_INTEGRATED_NUMBER,
      namespace: process.env.MSG91_NAMESPACE,
    },
    email: {
      authKey: process.env.MSG91_AUTHKEY,
      domain: process.env.MSG91_EMAIL_DOMAIN,
      fromEmail: process.env.MSG91_FROM_EMAIL,
    },
  },

  // SMTP PROVIDER (SEPARATE)
  smtp: {
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM,
  },
});
