import { Types } from 'mongoose';

/* ----------------------------------------------------
 * Payment Status – SINGLE SOURCE OF TRUTH
 * -------------------------------------------------- */
export type PaymentStatus =
  | 'initiated'
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'refunded'
  | 'cancelled';

/* ----------------------------------------------------
 * Initiate Payment (INTERNAL → GATEWAY)
 * -------------------------------------------------- */
export interface PaymentInitiateRequest {
  /**
   * Amount in paisa
   * ⚠️ MUST come from DB (CheckoutIntent.totalAmount)
   */
  amount: number;

  /**
   * Internal reference ID
   * We use CheckoutIntent._id as merchantTransactionId
   */
  merchantTransactionId: string;

  /**
   * Frontend redirect URL after payment
   */
  callbackUrl: string;
}

/* ----------------------------------------------------
 * Initiate Payment Response (GATEWAY → APP)
 * -------------------------------------------------- */
export interface PaymentInitiateResponse {
  /**
   * Gateway merchant order ID (PRIMARY KEY)
   * For PhonePe → same as merchantTransactionId
   */
  merchantOrderId: string;

  /**
   * Redirect URL for PhonePe Standard Checkout
   */
  redirectUrl: string;

  /**
   * Initial status (always pending)
   */
  status: 'pending';

  /**
   * Optional gateway message
   */
  message?: string;
}

/* ----------------------------------------------------
 * Verify Payment Status (Fallback only)
 * -------------------------------------------------- */
export interface PaymentStatusResponse {
  merchantOrderId: string;
  gatewayTransactionId?: string;

  status: PaymentStatus;

  amount: number;
  currency: 'INR';

  paymentMethod?: string;
  gatewayResponse?: any;

  paidAt?: Date;
  failureReason?: string;
}

/* ----------------------------------------------------
 * Webhook Payload (Normalized – SOURCE OF TRUTH)
 * -------------------------------------------------- */
export interface PaymentWebhookPayload {
  merchantOrderId: string;
  gatewayTransactionId?: string;

  /**
   * Normalized status
   * (mapped from gateway-specific states)
   */
  status: 'success' | 'failed' | 'pending';

  amount?: number;
  paymentMethod?: string;

  /**
   * Raw gateway payload (stored for audit/debug)
   */
  rawPayload: any;
}

/* ----------------------------------------------------
 * Refund
 * -------------------------------------------------- */
export interface RefundRequest {
  merchantOrderId: string;
  amount: number;
  reason?: string;
}

export interface RefundResponse {
  refundId: string;
  status: 'pending' | 'success' | 'failed';
  amount: number;
}

/* ----------------------------------------------------
 * Gateway Interface (STRICT CONTRACT)
 * -------------------------------------------------- */
export interface IPaymentGateway {
  /**
   * Initiate a payment transaction
   */
  initiatePayment(
    request: PaymentInitiateRequest,
  ): Promise<PaymentInitiateResponse>;

  /**
   * Verify payment status (fallback / manual check)
   */
  verifyPayment?(
    merchantOrderId: string,
  ): Promise<PaymentStatusResponse>;

  /**
   * Handle & verify webhook (SOURCE OF TRUTH)
   * For PhonePe: authHeader = Authorization header
   */
  handleWebhook(
    payload: any,
    authHeader?: string,
  ): Promise<PaymentWebhookPayload>;

  /**
   * Optional refund support
   */
  refundPayment?(
    request: RefundRequest,
  ): Promise<RefundResponse>;
}
