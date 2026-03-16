import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  IWhatsAppProvider,
  SendTemplateParams,
  WhatsAppResponse,
} from '../../domain/whatsapp.interface';
import logger from '../../../../common/utils/logger';

/**
 * Meta (Facebook) WhatsApp Cloud API Provider Implementation
 * Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
@Injectable()
export class MetaCloudWhatsAppProvider implements IWhatsAppProvider {

  private readonly ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN || '';
  private readonly PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || '';
  private readonly API_VERSION = 'v18.0';
  private readonly API_URL = `https://graph.facebook.com/${this.API_VERSION}/${this.PHONE_NUMBER_ID}/messages`;

  async sendTemplateMessage(
    params: SendTemplateParams,
  ): Promise<WhatsAppResponse> {
    try {
      // Build components array for Meta Cloud API
      const components = this.buildComponents(params.components);

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.to.replace('+', ''), // Meta doesn't want the +
        type: 'template',
        template: {
          name: params.templateName,
          language: {
            code: params.languageCode || 'en',
          },
          components,
        },
      };

      logger.debug(
        `[Meta Cloud API] Payload: ${JSON.stringify(payload, null, 2)}`,
      );

      const response = await axios.post(this.API_URL, payload, {
        headers: {
          Authorization: `Bearer ${this.ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info(
        `[Meta Cloud API] Response: ${JSON.stringify(response.data)}`,
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        rawResponse: response.data,
      };
    } catch (error: any) {
      logger.error(
        `[Meta Cloud API] Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
      );

      return {
        success: false,
        error:
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message,
        rawResponse: error.response?.data,
      };
    }
  }

  private buildComponents(
    components?: Record<string, any>,
  ): Array<{ type: string; parameters: any[] }> {
    if (!components) return [];

    const result: Array<{ type: string; parameters: any[] }> = [];

    // Group components by type (body, header, button)
    const bodyParams: any[] = [];
    const headerParams: any[] = [];
    const buttonParams: any[] = [];

    Object.entries(components).forEach(([key, value]) => {
      if (key.startsWith('body_')) {
        bodyParams.push({
          type: 'text',
          text: String(value),
        });
      } else if (key.startsWith('header_')) {
        headerParams.push({
          type: 'text',
          text: String(value),
        });
      } else if (key.startsWith('button_')) {
        buttonParams.push({
          type: 'text',
          text: String(value),
        });
      }
    });

    if (headerParams.length > 0) {
      result.push({ type: 'header', parameters: headerParams });
    }
    if (bodyParams.length > 0) {
      result.push({ type: 'body', parameters: bodyParams });
    }
    if (buttonParams.length > 0) {
      result.push({ type: 'button', parameters: buttonParams });
    }

    return result;
  }
}
