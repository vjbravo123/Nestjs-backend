// order-success.subject.ts
export function orderSuccessSubject(data: {
  orderId: string;
}) {
  return `Your order #${data.orderId} is complete 🎉`;
}
