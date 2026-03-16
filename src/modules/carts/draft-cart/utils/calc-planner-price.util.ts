export function calculatePlannerPriceBySubtotal(subtotal: number): number {
    const rawPlannerPrice = subtotal * 0.08;
    const plannerPrice = Math.round(rawPlannerPrice);

    return Math.min(Math.max(plannerPrice, 3000), 15000);
}
