import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvVariables } from './env/env.validator';
import appConfig from './app.config';
import phonepeConfig from './payment/phonepe.config';
import { FirebaseConfig } from './firebase.config';

/**
 * Validate environment variables at bootstrap
 * Fail-fast strategy (production safe)
 */
validateEnvVariables();

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,      // ✅ core app config
        phonepeConfig,  // ✅ PhonePe payment config
      ],
    }),
  ],
  providers: [
    FirebaseConfig, // ✅ PROVIDER (NOT import)
  ],
  exports: [
    FirebaseConfig, // ✅ usable across app
    ConfigModule,
  ],
})
export class AppConfigModule { }
