import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { PoliciesGuard } from './policies.guard';

/**
 * CaslModule is @Global — CaslAbilityFactory and PoliciesGuard are
 * available in every module without explicit import.
 *
 * Import this module once in AppModule.
 */
@Global()
@Module({
  providers: [CaslAbilityFactory, PoliciesGuard],
  exports: [CaslAbilityFactory, PoliciesGuard],
})
export class CaslModule {}
