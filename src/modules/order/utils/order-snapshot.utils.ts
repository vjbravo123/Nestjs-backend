/**
 * Pure helper functions for building order field snapshots from raw cart/intent data.
 * Extracted from OrderService to improve reusability and testability.
 */

export function mapTierSnapshot(tier: any) {
  console.log("tier's is a ", tier);
  return {
    tierId: tier.tierId,
    name: tier.name ?? 'Standard',
    price: tier.price ?? 0,
    features: tier.features ?? [],
  };
}

export function mapAddonSnapshotsFromSimplified(
  addons: any[],
  addonMap: Map<string, any>,
) {
  return (addons || []).flatMap((a: any) => {
    const addonDoc = addonMap.get(a?.addonId?.toString());
    if (!addonDoc) return [];

    return (a?.tiersWithSlot || []).map((tw: any) => {
      const tier = addonDoc.tiers?.find(
        (t: any) => t._id.toString() === tw?.tierId?.toString(),
      );
      const slots = (tw?.slots || []).map((s: any) => s.slotType);

      return {
        addOnId: addonDoc._id,
        name: addonDoc.name || '',
        selectedTier: {
          tierId: tier?._id || null,
          name: tier?.name || '',
          price: tier?.price || 0,
          description: tier?.description,
          venueSize: tier?.venueSize,
          features: tier?.features || [],
          slots: (tw?.slots || []).map((s: any) => ({
            slotType: s.slotType,
            quantity: s.quantity || 1,
          })),
        },
        addOnVendorId: addonDoc.createdBy,
        banner: addonDoc.banner || [],
        slots: slots,
      };
    });
  });
}
