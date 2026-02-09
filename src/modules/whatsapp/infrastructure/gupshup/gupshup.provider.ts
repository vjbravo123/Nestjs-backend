import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  IWhatsAppProvider,
  SendTemplateParams,
  WhatsAppResponse,
} from '../../domain/whatsapp.interface';
import logger from '../../../../common/utils/logger';

/**
 * Gupshup WhatsApp Provider Implementation
 * Documentation: https://docs.gupshup.io/docs/whatsapp-api-documentation
 */
@Injectable()
export class GupshupWhatsAppProvider implements IWhatsAppProvider {

  private readonly API_KEY = process.env.GUPSHUP_API_KEY || '';
  private readonly APP_NAME = process.env.GUPSHUP_APP_NAME || '';
  private readonly SOURCE_NUMBER = process.env.GUPSHUP_SOURCE_NUMBER || '';
  private readonly API_URL = 'https://api.gupshup.io/sm/api/v1/template/msg';

  async sendTemplateMessage(
    params: SendTemplateParams,
  ): Promise<WhatsAppResponse> {
    try {
      // Build template parameters for Gupshup
      const templateParams = this.buildTemplateParams(params.components);

      const formData = new URLSearchParams();
      formData.append('channel', 'whatsapp');
      formData.append('source', this.SOURCE_NUMBER);
      formData.append('destination', params.to);
      formData.append('src.name', this.APP_NAME);
      formData.append('template', JSON.stringify({
        id: params.templateName,
        params: templateParams,
      }));

      logger.debug(`[Gupshup] Request: ${formData.toString()}`);

      const response = await axios.post(this.API_URL, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          apikey: this.API_KEY,
        },
      });

      logger.info(`[Gupshup] Response: ${JSON.stringify(response.data)}`);

      return {
        success: response.data.status === 'submitted',
        messageId: response.data.messageId,
        rawResponse: response.data,
      };
    } catch (error: any) {
      logger.error(
        `[Gupshup] WhatsApp Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      };
    }
  }

  private buildTemplateParams(
    components?: Record<string, any>,
  ): string[] {
    if (!components) return [];

    // Gupshup expects params as array in order: ["value1", "value2", ...]
    const params: string[] = [];
    const sortedKeys = Object.keys(components).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

    sortedKeys.forEach((key) => {
      params.push(String(components[key]));
    });

    return params;
  }
}
