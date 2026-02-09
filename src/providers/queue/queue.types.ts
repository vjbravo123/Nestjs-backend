/**
 * ---------------------------------------------------------
 * Queue Job Payload Types
 * ---------------------------------------------------------
 * Rules:
 * - No business logic
 * - No framework imports
 * - Only interfaces / types
 * - Version-safe & reusable
 * ---------------------------------------------------------
 */

import { Types } from 'mongoose';

/* =======================
   🔔 NOTIFICATION QUEUE
   ======================= */

export interface SendPushJob {
  /** Receiver user id (required for domain lookup) */
  userId: Types.ObjectId;

  /** Push notification title */
  title: string;

  /** Push notification body */
  body: string;

  /**
   * Extra metadata for deep links, analytics, etc.
   * FCM requires string-based values only
   */
  data?: Record<string, string>;

  /**
   * Optional explicit device tokens.
   * If omitted, worker MUST fetch tokens from DB.
   *
   * NOTE:
   * - API may pass tokens for realtime use-cases
   * - Worker remains the source of truth
   */
  deviceTokens?: string[];
}

/* =======================
   📧 EMAIL QUEUE
   ======================= */

export interface SendEmailJob {
  /** Recipient email(s) */
  to: string | string[];

  /** Template key */
  template: EmailTemplate;

  /** Template variables */
  payload: Record<string, unknown>;

  /**
   * Optional override subject
   * If omitted → template subject is used
   */
  subject?: string;
}

/* =======================
   📱 SMS / WHATSAPP
   ======================= */

export interface SendSmsJob {
  to: string;
  message: string;
}

export interface SendWhatsAppJob {
  /** Recipient phone number (with country code, e.g., +919876543210) */
  to: string;

  /** WhatsApp template name */
  template: string;

  /** Language code (e.g., 'en', 'en_US') */
  language?: string;

  /** Template namespace (required by MSG91) */
  namespace?: string;

  /** Template variables/components */
  variables?: string[];

  /** Additional metadata for tracking */
  meta?: Record<string, any>;
}

/* =======================
   🔧 SHARED / UTILS
   ======================= */

/**
 * Allowed email templates
 * Extend when adding new templates
 */
export type EmailTemplate =
  | 'welcome'
  | 'order-success'
  | 'refund'
  | 'contact-us-alert'
  | 'partner-application-received'
  | 'partner-welcome'
  | 'booking-confirmed'
  | 'booking-updated'
  | 'booking-cancelled'
  | 'booking-completed'
  | 'payment-successful'
  | 'payment-failed';



/**
 * Generic Queue Job Envelope
 * Use ONLY if you want global tracing/versioning.
 *
 * ⚠️ Do NOT wrap Bull jobs automatically
 * unless you explicitly design for it.
 */
export interface QueueJob<TPayload> {
  /** Distributed tracing id */
  traceId?: string;

  /** Job payload */
  payload: TPayload;
}
