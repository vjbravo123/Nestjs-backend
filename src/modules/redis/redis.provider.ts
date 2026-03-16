import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const RedisProvider: Provider = {
  provide: 'REDIS_CLIENT',
  useFactory: async () => {
    console.log('🔨 RedisProvider: Creating client...');
    console.log('  REDIS_URL from env:', process.env.REDIS_URL || 'NOT SET');
    console.log('  REDIS_HOST from env:', process.env.REDIS_HOST || 'NOT SET');
    console.log('  REDIS_PORT from env:', process.env.REDIS_PORT || 'NOT SET');

    const client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 5,
          enableReadyCheck: true,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            console.log(`🔄 Redis retry (attempt ${times})...`);
            return delay;
          },
        })
      : new Redis({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 5,
          enableReadyCheck: true,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            console.log(`🔄 Redis retry (attempt ${times})...`);
            return delay;
          },
        });

    console.log(
      '  Connection method used:',
      process.env.REDIS_URL ? 'URL' : 'Host:Port:Password',
    );
    client.on('connect', () => console.log('✅ Redis connected'));
    client.on('error', (err) => console.error('❌ Redis error', err));
    client.on('ready', () => console.log('✅ Redis ready'));

    return client;
  },
};
