import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global() // 🔥 THIS IS REQUIRED
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): any => {
        const redisUrl = config.get<string>('REDIS_URL');
        const host = config.get<string>('REDIS_HOST') || '127.0.0.1';
        const port = config.get<number>('REDIS_PORT') || 6379;
        const password = config.get<string>('REDIS_PASSWORD');

        console.log('🚀 BullMqModule Redis Configuration:');
        console.log('  REDIS_URL from ConfigService:', redisUrl || 'NOT SET');
        console.log('  REDIS_HOST from ConfigService:', host);
        console.log('  REDIS_PORT from ConfigService:', port);
        console.log(
          '  Using connection method:',
          redisUrl ? 'URL' : 'Host:Port:Password',
        );

        const connection = redisUrl
          ? { url: redisUrl, maxRetriesPerRequest: null, enableReadyCheck: false }
          : { host, port, password, maxRetriesPerRequest: null, enableReadyCheck: false };

        return {
          connection,
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class BullMqModule {}
