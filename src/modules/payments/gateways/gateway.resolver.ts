import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PhonePeGateway } from './phonepe.gateway';
import { IPaymentGateway } from '../interfaces/payment-gateway.interface';

/**
 * Supported payment gateways
 * (extendable without breaking code)
 */
export type SupportedGateway = 'phonepe';

@Injectable()
export class GatewayResolver {
  constructor(
    private readonly phonePeGateway: PhonePeGateway,
  ) {}

  /**
   * Resolve gateway implementation
   */
  resolve(gateway: SupportedGateway): IPaymentGateway {
    switch (gateway) {
      case 'phonepe':
        return this.phonePeGateway;

      default:
        // ❌ never throw raw Error in NestJS
        throw new BadRequestException(
          `Unsupported payment gateway: ${gateway}`,
        );
    }
  }
}
