// src/cart/mappers/draft-to-cart.mapper.ts

import { DraftCartItem } from '../draft-cart/draft-cart.schema';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

export class DraftToCartMapper {
    static toCartItem(draft: DraftCartItem) {

        if (!draft.addressId) {
            throw new BadRequestException('Address is required for adding to cart');
        }

        return {
            _id: new Types.ObjectId(),

            // Event details
            eventCategory: draft.eventCategory,
            eventId: draft.eventId,
            eventTitle: draft.eventTitle ?? '',
            eventDiscount: draft.eventDiscount,

            // Pricing / tiers
            selectedTier: draft.selectedTier!,

            addons: (draft.addons || []).map(addon => ({
                addonId: addon.addonId,
                banner: addon.banner || [],
                assignAddonVendor: addon.assignAddonVendor ?? undefined,

                tiersWithSlot: (addon.tiersWithSlot || []).map(tier => ({
                    tierId: tier.tierId,

                    // ✅ keep snapshot
                    name: tier.name,
                    price: tier.price,
                    discount: tier.discount ?? 0,
                    features: tier.features ?? [],

                    slots: tier.slots || [],
                })),
            })),

            // Date & Time
            createdAt: new Date(),
            updatedAt: new Date(),
            eventDate: draft.eventDate,
            eventTime: draft.eventTime,
            eventBookingDate: draft.eventBookingDate,
            assignVendor: draft.assignVendor,
            addressDetails: draft.addressDetails,

            // Address
            addressId: draft.addressId,

            // Price
            subtotal: draft.subtotal ?? 0,
            plannerPrice: draft.plannerPrice ?? 0,

            // Cart meta
            status: 'active',
            isPaid: false,
        };
    }
}
