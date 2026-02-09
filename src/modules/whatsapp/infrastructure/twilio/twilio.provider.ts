import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  IWhatsAppProvider,
  SendTemplateParams,
  WhatsAppResponse,
} from '../../domain/whatsapp.interface';
import logger from '../../../../common/utils/logger';

/**
 * Twilio WhatsApp Provider Implementation
 * Documentation: https://www.twilio.com/docs/whatsapp/api
 */
@Injectable()
export class TwilioWhatsAppProvider implements IWhatsAppProvider {

  private readonly ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
  private readonly AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
  private readonly WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || '';
  private readonly API_URL = `https://api.twilio.com/2010-04-01/Accounts/${this.ACCOUNT_SID}/Messages.json`;

  async sendTemplateMessage(
    params: SendTemplateParams,
  ): Promise<WhatsAppResponse> {
    try {
      // Twilio uses a different format - build template body with variables
      const templateBody = this.buildTemplateBody(
        params.templateName,
        params.components,
      );

      const formData = new URLSearchParams();
      formData.append('From', `whatsapp:${this.WHATSAPP_NUMBER}`);
      formData.append('To', `whatsapp:${params.to}`);
      formData.append('Body', templateBody);
      formData.append('ContentSid', params.templateName); // If using Content API

      logger.debug(`[Twilio] Request: ${formData.toString()}`);

      const response = await axios.post(this.API_URL, formData, {
        auth: {
          username: this.ACCOUNT_SID,
          password: this.AUTH_TOKEN,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      logger.info(`[Twilio] Response: ${JSON.stringify(response.data)}`);

      return {
        success: true,
        messageId: response.data.sid,
        rawResponse: response.data,
      };
    } catch (error: any) {
      logger.error(
        `[Twilio] WhatsApp Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      };
    }
  }

  private buildTemplateBody(
    templateName: string,
    components?: Record<string, any>,
  ): string {
    // Replace template variables with actual values
    // Example: "Hello {{1}}, your order {{2}} is confirmed"
    let body = templateName;

    if (components) {
      Object.entries(components).forEach(([key, value]) => {
        const match = key.match(/body_(\d+)/);
        if (match) {
          const index = match[1];
          body = body.replace(`{{${index}}}`, String(value));
        }
      });
    }

    return body;
  }
}
