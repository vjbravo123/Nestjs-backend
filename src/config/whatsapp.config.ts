import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

export interface WhatsAppConfig {
  msg91AuthKey: string;
  msg91IntegratedNumber: string;
  msg91TemplateNamespace: string;
  adminWhatsAppNumber: string;
}

@Injectable()
export class WhatsAppConfigService {
  private readonly config: WhatsAppConfig;

  constructor() {
    this.config = this.validateConfig();
  }

  private validateConfig(): WhatsAppConfig {
    const msg91AuthKey = process.env.MSG91_AUTH_KEY;
    const msg91IntegratedNumber = process.env.MSG91_INTEGRATED_NUMBER;
    const msg91TemplateNamespace = process.env.MSG91_TEMPLATE_NAMESPACE;
    const adminWhatsAppNumber = process.env.ADMIN_WHATSAPP_NUMBER;

    // Validate required fields
    const missingVars: string[] = [];

    if (!msg91AuthKey) {
      missingVars.push('MSG91_AUTH_KEY');
    }
    if (!msg91IntegratedNumber) {
      missingVars.push('MSG91_INTEGRATED_NUMBER');
    }
    if (!msg91TemplateNamespace) {
      missingVars.push('MSG91_TEMPLATE_NAMESPACE');
    }
    if (!adminWhatsAppNumber) {
      missingVars.push('ADMIN_WHATSAPP_NUMBER');
    }

    if (missingVars.length > 0) {
      throw new Error(
        `❌ WhatsApp Configuration Error: Missing required environment variables: ${missingVars.join(', ')}\n` +
          `Please add these to your .env file.`,
      );
    }

    // Validate phone number format
    if (!adminWhatsAppNumber!.startsWith('+')) {
      console.warn(
        `⚠️ Warning: ADMIN_WHATSAPP_NUMBER should start with '+' (e.g., +919876543210). Current value: ${adminWhatsAppNumber}`,
      );
    }

    return {
      msg91AuthKey: msg91AuthKey!,
      msg91IntegratedNumber: msg91IntegratedNumber!,
      msg91TemplateNamespace: msg91TemplateNamespace!,
      adminWhatsAppNumber: adminWhatsAppNumber!,
    };
  }

  get msg91AuthKey(): string {
    return this.config.msg91AuthKey;
  }

  get msg91IntegratedNumber(): string {
    return this.config.msg91IntegratedNumber;
  }

  get msg91TemplateNamespace(): string {
    return this.config.msg91TemplateNamespace;
  }

  get adminWhatsAppNumber(): string {
    return this.config.adminWhatsAppNumber;
  }

  getConfig(): WhatsAppConfig {
    return { ...this.config };
  }
}
