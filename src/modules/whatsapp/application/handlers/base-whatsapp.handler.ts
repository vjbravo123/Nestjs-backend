/**
 * Base contract for all WhatsApp event handlers.
 *
 * Every WhatsApp handler MUST extend this class.
 * This enables automatic discovery via WhatsappHandlerRegistry.
 */
export abstract class BaseWhatsappHandler {
  /**
   * Unique event name this handler is responsible for
   * Example: 'BOOKING_CANCELLED', 'USER_REGISTERED'
   */
  abstract readonly eventName: string;

  /**
   * Handle the WhatsApp notification logic
   */
  abstract handle(payload: any): Promise<void>;
}
