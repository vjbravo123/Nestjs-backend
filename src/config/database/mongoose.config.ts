import { MongooseModuleOptions } from '@nestjs/mongoose';
import { env } from '../env/env.loader';

export const mongooseConfig = (): MongooseModuleOptions => ({
  uri: env.MONGODB_URL,
  retryAttempts: 5,
  retryDelay: 3000,
  autoIndex: env.NODE_ENV === 'development', // Only auto-create indexes in development
});
