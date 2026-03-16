import { CartData, AddonItem } from '../cart.schema';

/**
 * Cart Price Calculation Utilities
 * Centralized price calculation logic for cart items
 */

// -------------------------
// Interfaces
// -------------------------

export interface ItemPriceResult {
    originalBasePrice: number;
    discountPercent: number;
    discountAmount: number;
    finalBasePrice: number;
    addonTotal: number;
    plannerPrice: number;
    subtotal: number;
}

export interface CartPriceSummary {
    items: ItemPriceResult[];
    totalAmount: number;
    itemCount: number;
}

// -------------------------
// Helper Functions
// -------------------------

/**
 * Round to 2 decimal places (handles floating point precision)
 */
export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate total quantity of slots
 */
function calculateSlotQuantity(slots: any[] | undefined): number {
    if (!slots?.length) return 1;

    return slots.reduce((sum, slot) => sum + (slot?.quantity || 1), 0);
}

// -------------------------
// Addon Pricing (NEW FORMAT)
// -------------------------

/**
 * Calculate addon total using tiersWithSlot + slot.quantity
 *
 * Formula per tier:
 * (tier.price - tier.discount%) * sum(slot.quantity)
 */
export function calculateAddonTotal(addons: AddonItem[] | undefined): number {
    if (!addons?.length) return 0;

    let total = 0;

    for (const addon of addons) {
        for (const tier of addon.tiersWithSlot || []) {
            const tierPrice = tier.price || 0;

            const rawDiscount = tier.discount || 0;
            const discountPercent = Math.min(Math.max(rawDiscount, 0), 100);

            const discountAmount = round2((tierPrice * discountPercent) / 100);
            const finalTierPrice = round2(tierPrice - discountAmount);

            const quantity = calculateSlotQuantity(tier.slots);

            total += round2(finalTierPrice * quantity);
        }
    }

    return round2(total);
}

// -------------------------
// Main Item Pricing
// -------------------------

/**
 * Calculate the full price breakdown for a single cart item
 */
export function calculateItemPrice(item: Partial<CartData>): ItemPriceResult {
    const originalBasePrice = item?.selectedTier?.price || 0;

    const rawDiscount = item?.eventDiscount || 0;
    const discountPercent = Math.min(Math.max(rawDiscount, 0), 100);

    const discountAmount = round2(
        (originalBasePrice * discountPercent) / 100,
    );

    const finalBasePrice = round2(
        originalBasePrice - discountAmount,
    );

    const addonTotal = calculateAddonTotal(item?.addons);

    const plannerPrice = round2(item?.plannerPrice || 0);

    const subtotal = round2(
        finalBasePrice + addonTotal + plannerPrice,
    );



    return {
        originalBasePrice,
        discountPercent,
        discountAmount,
        finalBasePrice,
        addonTotal,
        plannerPrice,
        subtotal,
    };
}

/**
 * Simple subtotal helper
 */
export function calculateItemSubtotal(item: Partial<CartData>): number {
    return calculateItemPrice(item).subtotal;
}

// -------------------------
// Cart Level
// -------------------------

/**
 * Calculate total amount for entire cart
 */
export function calculateCartTotal(items: Partial<CartData>[] | undefined): number {
    if (!items || !Array.isArray(items)) return 0;

    const total = items.reduce(
        (sum, item) => sum + calculateItemSubtotal(item),
        0,
    );

    return round2(total);
}

/**
 * Get full cart price summary
 */
export function getCartPriceSummary(items: Partial<CartData>[] | undefined): CartPriceSummary {
    if (!items || !Array.isArray(items)) {
        return { items: [], totalAmount: 0, itemCount: 0 };
    }

    const itemBreakdowns = items.map(item => calculateItemPrice(item));

    const totalAmount = round2(
        itemBreakdowns.reduce((sum, b) => sum + b.subtotal, 0),
    );

    return {
        items: itemBreakdowns,
        totalAmount,
        itemCount: items.length,
    };
}

/**
 * Mutates cart: updates each item subtotal + cart total
 */
export function recalculateCartPrices(cart: { items: Partial<CartData>[]; totalAmount?: number }): number {
    if (!cart.items || !Array.isArray(cart.items)) {
        cart.totalAmount = 0;
        return 0;
    }

    cart.items.forEach(item => {
        item.subtotal = calculateItemSubtotal(item);
    });

    cart.totalAmount = calculateCartTotal(cart.items);

    return cart.totalAmount;
}

/**
 * Calculate subtotal for checked-out items only (isCheckOut === 1)
 */
export function calculateCheckoutTotal(items: Partial<CartData>[] | undefined): number {
    if (!items || !Array.isArray(items)) return 0;

    const total = items
        .filter(item => item.isCheckOut === 1)
        .reduce((sum, item) => sum + calculateItemSubtotal(item), 0);

    return round2(total);
}
