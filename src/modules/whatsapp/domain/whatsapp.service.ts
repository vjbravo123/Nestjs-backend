import { Injectable } from '@nestjs/common';
import { IWhatsAppProvider, SendTemplateParams } from './whatsapp.interface';
import logger from '../../../common/utils/logger';

/**
 * Domain Service for WhatsApp Operations
 * Contains business logic for sending WhatsApp messages
 */
@Injectable()
export class WhatsAppService {
  constructor(private readonly whatsappProvider: IWhatsAppProvider) { }

  /**
   * Send a WhatsApp template message
   */
  async sendTemplateMessage(params: SendTemplateParams) {
    logger.info(
      `[WhatsApp Service] Sending template: ${params.templateName} to ${params.to}`,
    );

    try {
      const result = await this.whatsappProvider.sendTemplateMessage(params);

      if (result.success) {
        logger.info(
          `[WhatsApp Service] Message sent successfully. MessageId: ${result.messageId}`,
        );
      } else {
        logger.error(
          `[WhatsApp Service] Message failed: ${result.error}`,
        );
      }

      return result;
    } catch (error) {
      logger.error('[WhatsApp Service] Send error', error);
      throw error;
    }
  }
}
