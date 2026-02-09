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
            _id: new Types.ObjectId(), // ⭐ Always create new _id for cart item

            // Event details
            eventCategory: draft.eventCategory,
            eventId: draft.eventId,
            eventTitle: draft.eventTitle ?? '',

            // Pricing / tiers
            selectedTier: draft.selectedTier!,
            addons: draft.addons || [],

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
