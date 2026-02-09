import { CheckoutItemData } from '../checkout-intent.schema';

export class CheckoutResponseDto {
    intentId: string;
    totalAmount: number;
    items: CheckoutItemData[];   // ✅ matches DB return
    status: string;
    discount?: number;
    couponCode?: string;
}
