import { Types } from 'mongoose';
import {
    TierSnapshot,
    AddonItem,
    AddressSnapshot,
} from '../../carts/cart.schema';
import { EventCategory } from '../../../common/enums/event-category.enum';

export interface CheckoutItem {
    eventId: Types.ObjectId;
    eventCategory: EventCategory;
    eventTitle: string;

    selectedTier: TierSnapshot;
    assignVendor?: Types.ObjectId | null;

    timeSlot?: string;
    eventDate?: string;
    eventTime?: string;
    eventBookingDate?: Date;
    addressId?: Types.ObjectId | null;
    addons?: AddonItem[];

    // 🔴 OPTIONAL — only present after checkout
    addressDetails?: AddressSnapshot;

    subtotal: number;

    // 🔴 OPTIONAL — may not exist for all events
    plannerPrice?: number;
}
