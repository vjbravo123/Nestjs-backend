import { Module } from '@nestjs/common';
import { RedisProvider } from './redis.provider';

@Module({
  providers: [RedisProvider],
  exports: ['REDIS_CLIENT'], // export so other modules can use it
})
export class RedisModule {}
