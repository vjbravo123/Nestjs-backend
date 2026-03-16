import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  IWhatsAppProvider,
  SendTemplateParams,
  WhatsAppResponse,
} from '../../domain/whatsapp.interface';
import { WhatsAppConfigService } from '../../../../config/whatsapp.config';
import logger from '../../../../common/utils/logger';

/**
 * MSG91 WhatsApp Provider Implementation
 */
@Injectable()
export class Msg91WhatsAppProvider implements IWhatsAppProvider {
  private readonly API_URL =
    'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

  constructor(private readonly config: WhatsAppConfigService) { }

  async sendTemplateMessage(
    params: SendTemplateParams,
  ): Promise<WhatsAppResponse> {
    try {
      // Build components dynamically
      const components: any = {};

      if (params.components) {
        Object.entries(params.components).forEach(([key, value]) => {
          components[key] = {
            type: 'text',
            value: String(value),
          };
        });
      }

      const payload = {
        integrated_number: this.config.msg91IntegratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: params.templateName,
            language: {
              code: params.languageCode || 'en_US',
              policy: 'deterministic',
            },
            namespace: params.namespace || this.config.msg91TemplateNamespace,
            to_and_components: [
              {
                to: [params.to],
                components,
              },
            ],
          },
        },
      };

      logger.debug(
        `[MSG91] Payload: ${JSON.stringify(payload, null, 2)}`,
      );

      const response = await axios.post(this.API_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
          authkey: this.config.msg91AuthKey,
        },
      });

      logger.info(`[MSG91] Response: ${JSON.stringify(response.data)}`);

      return {
        success: true,
        messageId: response.data?.messageId || response.data?.id,
        rawResponse: response.data,
      };
    } catch (error: any) {
      logger.error(
        `[MSG91] WhatsApp Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      };
    }
  }
}
