import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import mongoose from 'mongoose';

// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

// import * as Sentry from '@sentry/node';
import logger from './common/utils/logger';
import { WinstonLoggerService } from './common/utils/winston-logger.service';
import { validateEnvVariables } from './config/env/env.validator';
import * as dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
// import cookieParser from 'cookie-parser';
import { AutoParseJsonPipe } from './common/pipes/auto-parse-json.pipe';
import { booleanNormalizer } from './common/middleware/boolean-normalizer.middleware';
// Load environment variables
dotenv.config();

async function bootstrap() {
  // Log Redis configuration at startup
  console.log('📋 REDIS Configuration:');
  console.log('  REDIS_URL:', process.env.REDIS_URL || 'NOT SET');
  console.log('  REDIS_HOST:', process.env.REDIS_HOST || 'NOT SET');
  console.log('  REDIS_PORT:', process.env.REDIS_PORT || 'NOT SET');

  // Validate environment
  validateEnvVariables();

  // Create custom logger instance
  const customLogger = new WinstonLoggerService();

  const app = await NestFactory.create(AppModule, {
    logger: customLogger,
    bufferLogs: true,
  });

  // ✅ Swagger Configuration 
  // const swaggerConfig = new DocumentBuilder()
  //   .setTitle('Zappy API')
  //   .setDescription('Zappy Backend API Documentation')
  //   .setVersion('1.0')
  //   .addBearerAuth() // for JWT support
  //   .build();

  // const document = SwaggerModule.createDocument(app, swaggerConfig);
  // SwaggerModule.setup('api-docs', app, document);

  // Enable CORS with credentials and trusted domains
  app.enableCors({
    origin: [
      'http://65.1.248.44:3000',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://192.168.29.31:3000',
      'http://192.168.29.31:3001',
      'https://zappy-h1td.onrender.com',
      'https://zappy-admin-nine.vercel.app',
      'https://zappy-gilt.vercel.app',
      'https://zappyeventz.com',
      'https://www.zappyeventz.com',
      'https://zappy-eventz.vercel.app',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
    ],
    exposedHeaders: ['set-cookie'],
  });

  // Increase body size limit for JSON and URL encoded data
  // Middleware order - FIXED ✅
  app.use(cookieParser());

  // Parse JSON and URL-encoded form bodies FIRST
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

  // Then normalize booleans AFTER body is available
  app.use(booleanNormalizer); // ✅ Now it will work
  // Global pipes
  app.useGlobalPipes(
    new AutoParseJsonPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // transformOptions: {
      //     enableImplicitConversion: true,
      // },
      enableDebugMessages: true,
      stopAtFirstError: true,
      validationError: {
        target: false,
        value: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Sentry setup
  // if (process.env.SENTRY_DSN) {
  //     logger.info('Configuring Sentry...');
  //     Sentry.init({
  //         dsn: process.env.SENTRY_DSN,
  //         environment: process.env.NODE_ENV || 'development',
  //         tracesSampleRate: 1.0,
  //     });
  // }

  // Start server

  await app.init(); // ensure modules/models registered
  customLogger.log('Mongoose models: ' + mongoose.modelNames().join(', '), 'Bootstrap');

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  customLogger.log(`✨ Application is running on: http://localhost:${port}`, 'Bootstrap');
  customLogger.log(`🌍 Environment: ${process.env.NODE_ENV}`, 'Bootstrap');
}

bootstrap();
