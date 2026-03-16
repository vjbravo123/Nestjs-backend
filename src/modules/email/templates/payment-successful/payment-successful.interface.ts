export interface PaymentSuccessfulEmailData {
  userName: string;
  bookingId: string;
  amount: string | number;
  paymentMethod: string;
  paymentDate: string;
  currency: string;
  transactionId: string;
  paymentId: string;
  merchantOrderId: string;
  eventName: string;
  eventDate: string;
  venue: string;
}
