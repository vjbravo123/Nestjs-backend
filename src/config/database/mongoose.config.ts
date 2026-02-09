import { MongooseModuleOptions } from '@nestjs/mongoose';
import { env } from '../env/env.loader';



export const mongooseConfig = (): MongooseModuleOptions => ({
  uri: env.MONGODB_URL,
  retryAttempts: 5,
  retryDelay: 3000,
  autoIndex: true,
});
