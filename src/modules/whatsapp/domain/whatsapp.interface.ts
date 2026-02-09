/**
 * WhatsApp Provider Interface
 * Abstraction for WhatsApp messaging providers (MSG91, Twilio, etc.)
 */
export interface IWhatsAppProvider {
  /**
   * Send a template-based WhatsApp message
   */
  sendTemplateMessage(params: SendTemplateParams): Promise<WhatsAppResponse>;
}

export interface SendTemplateParams {
  /** Recipient phone number (with country code, e.g., +919876543210) */
  to: string;

  /** Template name */
  templateName: string;

  /** Language code (e.g., 'en_US', 'en') */
  languageCode?: string;

  /** Template variables/components */
  components?: Record<string, any>;

  /** Template namespace (provider-specific) */
  namespace?: string;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  rawResponse?: any;
}
