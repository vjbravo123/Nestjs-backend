import { AddonItem, TierSnapshot } from '../draft-cart.schema';

export function calculateDraftCartSubtotal(
    selectedTier?: TierSnapshot,
    addons: AddonItem[] = [],
    eventDiscount: number = 0, // discount belongs to event
): number {
    if (!selectedTier) return 0;

    // 1️⃣ Base tier snapshot price
    const basePrice = selectedTier.price ?? 0;

    // 2️⃣ Apply event-level discount
    const discountedBase =
        eventDiscount > 0
            ? basePrice - (basePrice * eventDiscount) / 100
            : basePrice;

    // 3️⃣ Addon totals (using stored snapshot prices)
    const addonTotal = addons.reduce(
        (sum, addon) => sum + (addon?.selectedTier?.price ?? 0),
        0
    );

    // 4️⃣ Final subtotal (rounded to int)
    return Math.round(discountedBase + addonTotal);
}
