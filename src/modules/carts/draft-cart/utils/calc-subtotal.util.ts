import { TierSnapshot } from '../draft-cart.schema';

/**
 * Calculate draft cart subtotal from base tier price and discount.
 * Note: Addon prices are now calculated by the pre-save hook since
 * addons only store IDs. Use draft.subtotal for the full total.
 * @deprecated Use draft.subtotal instead - it includes addon prices calculated by pre-save hook
 */
export function calculateDraftCartSubtotal(
    selectedTier?: TierSnapshot,
    _addons: unknown[] = [], // Addons no longer have prices stored
    eventDiscount: number = 0,
): number {
    if (!selectedTier) return 0;

    // 1️⃣ Base tier snapshot price
    const basePrice = selectedTier.price ?? 0;

    // 2️⃣ Apply event-level discount
    const discountedBase =
        eventDiscount > 0
            ? basePrice - (basePrice * eventDiscount) / 100
            : basePrice;

    // Note: Addon prices are calculated by pre-save hook, not here
    // 3️⃣ Final subtotal (rounded to int) - base price only
    return Math.round(discountedBase);
}
