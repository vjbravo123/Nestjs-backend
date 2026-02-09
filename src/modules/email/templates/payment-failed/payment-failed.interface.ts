export interface PaymentFailedEmailData {
  userName: string;
  bookingId: string;
  amount: string | number;
  paymentMethod: string;
  paymentDate: string;
  transactionId: string;
  failureReason: string;
  eventName: string;
  eventDate: string;
  venue: string;
}
