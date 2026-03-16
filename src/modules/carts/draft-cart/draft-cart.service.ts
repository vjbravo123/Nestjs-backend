import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AddonItem, DraftCartItem, DraftCartItemDocument, TierWithSlot } from './draft-cart.schema';
import { AddToDraftDto } from './dto/add-to-draft.dto';
import { UpdateDraftScheduleDto } from './dto/update-draft-schedule.dto';
import { UpdateDraftAddonsDto } from './dto/update-draft-addon.dto';
import { UpdateDraftAddressDto } from './dto/update-draft-address.dto';
import { UpdateDraftUpgradeEventTierDto } from './dto/upgrade-draft-event-tier.dto'
import { mergeDateAndTime } from '../../../common/utils/mergeDateAndTime';
import { AddOnService } from '../../addOn/addon.service';
import { calculatePlannerPriceBySubtotal } from './utils/calc-planner-price.util'
// Event Models
import { BirthdayEvent } from '../../birthdayevent/birthdayevent.schema';
import { ExperientialEvent } from '../../experientialevent/experientialevent.schema';
import { AddOn } from '../../addOn/addon.schema';

import { VendorBookingService } from '../../order/vendor-bookings/vendor-booking.service'

@Injectable()
export class DraftCartService {
    private readonly logger = new Logger(DraftCartService.name);
    private readonly vendorBookingService: VendorBookingService
    constructor(
        @InjectModel(DraftCartItem.name)
        private readonly draftCartModel: Model<DraftCartItemDocument>,

        @InjectModel(BirthdayEvent.name)
        private readonly birthdayEvent: Model<any>,

        @InjectModel(ExperientialEvent.name)
        private readonly experienceEvent: Model<any>,


        @InjectModel(AddOn.name)
        private readonly addon: Model<any>,

        @Inject(forwardRef(() => AddOnService))
        private readonly addOnService: AddOnService,
    ) {
        this.logger.debug(`mongoose models: ${draftCartModel.modelName}, ${birthdayEvent.modelName}, ${experienceEvent.modelName}`);
    }

    // 🔍 Pick correct Event model based on category
    private getEventModel(category: string) {
        switch (category) {
            case 'BirthdayEvent':
                return this.birthdayEvent;
            case 'ExperientialEvent':
                return this.experienceEvent;
            case 'AddOn':
                return this.addon;

            default:
                throw new BadRequestException(`Invalid event category: ${category}`);
        }
    }

    // ─────────── Add or Update Draft Event ───────────
    async addOrUpdateDraft(
        userId: Types.ObjectId,
        dto: AddToDraftDto,
    ): Promise<{ message: string; item: DraftCartItem }> {
        const { eventCategory, eventId, selectedTierId } = dto;
        if (!eventCategory || !eventId || !selectedTierId) {
            throw new BadRequestException(
                'eventCategory, eventId, and selectedTierId are required.'
            );
        }

        // 1️⃣ Fetch Event
        const EventModel = this.getEventModel(eventCategory);
        const event = await EventModel.findById(eventId);
        console.log("event title in draft service", event)
        if (!event) throw new NotFoundException(`Event not found: ${eventId}`);
        console.log("even inside the draft", event)
        // 2️⃣ Extract Tier
        const tier = event.tiers?.find(t => t._id.toString() === selectedTierId.toString());
        if (!tier) throw new NotFoundException('Tier not found');
        console.log("discount add", event.discount)
        const tierSnapshot = {
            tierId: tier._id,
            name: tier.name,
            price: tier.price,
            features: tier.features,
        };

        // 3️⃣ Get or create draft cart
        let draft = await this.draftCartModel.findOne({ userId });
        if (!draft) {
            draft = new this.draftCartModel({
                userId,
                eventCategory,
                eventId,
                eventTitle: event.title || event.name || '',

                eventDiscount: event.discount,
                selectedTier: tierSnapshot,
                assignVendor: event.createdBy || null,
                city: dto.city || undefined,
                addons: [],
                subtotal: 0,
                isCompleted: false,
            });
            await draft.save();
            return { message: 'added', item: draft };
        }

        let message: 'added' | 'updated' | 'replaced' = 'updated';

        // 4️⃣ Check if user is changing the event
        if (draft.eventId.toString() !== eventId.toString()) {
            console.log(
                "replacing old event with new event in draft cart   "
            )
            // Replacing old event
            draft.eventCategory = eventCategory;
            draft.eventId = eventId;
            draft.eventTitle = event.title || event.name || '';
            draft.eventDiscount = event.discount;
            draft.selectedTier = tierSnapshot;
            draft.assignVendor = event.createdBy || null;
            draft.city = dto.city || undefined;
            draft.addons = []; // Reset addons
            draft.subtotal = tier.price;
            draft.plannerPrice = undefined;
            draft.eventBookingDate = undefined;
            draft.eventDate = undefined;
            draft.eventTime = undefined
            draft.addressId = undefined
            message = 'replaced';
        } else if (draft.selectedTier?.tierId.toString() !== selectedTierId.toString()) {
            console.log("updating tier in draft cart")
            // Same event, but different tier
            draft.selectedTier = tierSnapshot;
            draft.addons = []; // Optional: reset addons if incompatible
            draft.subtotal = tier.price;
            draft.eventBookingDate = undefined;
            draft.eventDate = draft.eventDate;
            draft.eventTime = draft.eventTime
            draft.addressId = draft.addressId
            draft.assignVendor = event.createdBy || null;
            draft.eventDiscount = event.discount;
            message = 'updated';
        } else {
            // message = 'unchanged';
        }



        console.log("final draft before save", draft)

        await draft.save();

        return { message, item: draft };
    }



    // ─────────── Update Draft Schedule ───────────
    async updateDraftSchedule(
        userId: Types.ObjectId,
        dto: UpdateDraftScheduleDto,
    ) {
        const { eventDate, eventTime, city } = dto;

        // 1️⃣ Fetch the draft cart with populated references
        const draft = await this.draftCartModel
            .findOne({ userId })
            .populate('userId')       // populates user data
            .populate('eventId');     // populates event details
        if (!draft) throw new NotFoundException('Draft cart not found.');

        // 2️⃣ Verify the item ID matches the draft cart (single event)
        // if (draft._id.toString() !== cartItemId.toString()) {
        //     throw new NotFoundException('Draft item not found.');
        // }

        // 3️⃣ Validate input
        if (!eventDate || !eventTime) {
            throw new BadRequestException('Event date & time are required.');
        }

        // 4️⃣ Merge schedule
        const eventBookingDate = mergeDateAndTime(eventDate, eventTime);
        draft.eventDate = eventDate;
        draft.eventTime = eventTime;
        draft.city = city;


        draft.eventBookingDate = eventBookingDate;

        // 5️⃣ Booking availability check
        if (draft.addressId && draft.userId) {
            // ⚡ Cast populated userId to a proper object
            const user = draft.userId as any; // or define a User interface
            const selectedAddress = user.addresses?.find(
                (addr: any) => addr._id.toString() === draft.addressId?.toString()
            );

            const event: any = draft.eventId;

            if (selectedAddress?.city && Array.isArray(event?.city)) {
                const startOfDay = new Date(eventDate);
                startOfDay.setUTCHours(0, 0, 0, 0);

                const endOfDay = new Date(eventDate);
                endOfDay.setUTCHours(23, 59, 59, 999);

                const existingBookings = await this.draftCartModel.countDocuments({
                    eventId: draft.eventId,
                    eventBookingDate: { $gte: startOfDay, $lte: endOfDay },
                    addressId: draft.addressId,
                });

                const maxBookings = event.city.find(
                    (c: any) => c.name === selectedAddress.city
                )?.maxBookingsPerDay;

                if (maxBookings && existingBookings >= maxBookings) {
                    throw new BadRequestException(
                        'Selected date is fully booked. Choose another date.'
                    );
                }
            }
        }

        // 6️⃣ Save draft
        await draft.save();

        // 7️⃣ Return updated draft
        return {
            message: 'Draft schedule updated successfully',
            item: {
                draftId: draft._id,
                eventId: draft.eventId._id,
                eventDate: draft.eventDate,
                eventTime: draft.eventTime,
                eventBookingDate: draft.eventBookingDate,
            },
        };
    }



    // // ─────────── Update Draft Addons ───────────
    async updateDraftAddons(
        userId: Types.ObjectId,
        dto: UpdateDraftAddonsDto,
    ) {
        const { addons: incomingAddons = [] } = dto;

        // -----------------------------------------
        // 1️⃣ Fetch draft
        // -----------------------------------------
        const draft = await this.draftCartModel.findOne({ userId });

        if (!draft) {
            throw new NotFoundException('No active draft cart found.');
        }

        if (!Array.isArray(incomingAddons)) {
            throw new BadRequestException('addons must be an array.');
        }

        // -----------------------------------------
        // 2️⃣ Validate addons and tiers exist
        // -----------------------------------------
        const validatedAddons: AddonItem[] = [];

        for (const input of incomingAddons) {
            const { addonId, tiersWithSlot } = input;

            // Validate addon exists
            const addOn = await this.addOnService.getAddOnDetailsByAdmin(
                addonId.toString(),
            );

            if (!addOn) {
                throw new BadRequestException(`Addon not found: ${addonId}`);
            }

            // Validate tiers exist
            const validatedTiers: TierWithSlot[] = [];

            for (const tierInput of tiersWithSlot || []) {
                const tier = addOn.tiers.find(
                    t => t._id.toString() === tierInput.tierId.toString(),
                );

                if (!tier) {
                    throw new BadRequestException(
                        `Invalid tier ${tierInput.tierId} for addon ${addonId}`,
                    );
                }

                validatedTiers.push({
                    tierId: tier._id,

                    // ✅ Schema fields
                    name: tier.name,
                    price: tier.price,
                    discount: tier.discount ?? 0,
                    features: tier.features ?? [],

                    slots: (tierInput.slots || []).map(s => ({
                        slotType: s.slotType,
                        quantity: s.quantity || 1,
                    })),
                });
            }

            validatedAddons.push({
                addonId: addOn._id,
                banner: addOn.banner || [],
                assignAddonVendor: addOn.createdBy ?? null, // ✅ schema aligned
                tiersWithSlot: validatedTiers,
            });
        }

        // -----------------------------------------
        // 3️⃣ Replace addons with validated data
        // -----------------------------------------
        draft.addons = validatedAddons;

        // -----------------------------------------
        // 4️⃣ Save (subtotal handled by pre-save hook)
        // -----------------------------------------
        await draft.save();

        return {
            message: 'Draft addons updated successfully.',
            data: draft,
        };
    }



    async updateDraftAddress(
        userId: Types.ObjectId,
        dto: UpdateDraftAddressDto,
    ) {
        const { addressId, isPlanner } = dto;

        console.log("📍 Incoming addressId:", addressId);

        const draftCartUpdate = await this.draftCartModel
            .findOne({ userId })
            .populate('userId')
            .populate({
                path: 'eventId',
                strictPopulate: false,
            })
            .populate({
                path: 'addons.addonId',
                strictPopulate: false,
            });

        if (!draftCartUpdate) {
            throw new NotFoundException('No active draft cart found.');
        }

        console.log("🛒 Draft Cart Found:", draftCartUpdate);

        const user = draftCartUpdate.userId as any;

        if (!user?.addresses?.length) {
            throw new NotFoundException('Please add address.');
        }

        const selectedAddress = user.addresses.find(
            (addr: any) => addr._id.toString() === addressId.toString()
        );

        console.log("📦 Selected Address:", selectedAddress);

        if (!selectedAddress) {
            throw new BadRequestException("Address incorrect");
        }

        const selectedCity = selectedAddress.city?.toLowerCase();

        console.log("🏙 Selected Address City:", selectedCity);

        /**
         * EVENT CITY VALIDATION
         */
        const event = draftCartUpdate.eventId as any;

        if (event?.city?.length) {

            console.log("🎉 Event Cities:", event.city);

            const eventCityAllowed = event.city.some(
                (c: any) => c.name?.toLowerCase() === selectedCity
            );

            console.log("✅ Event City Match:", eventCityAllowed);

            if (!eventCityAllowed) {
                console.log("❌ Event not available in:", selectedCity);

                throw new BadRequestException(
                    `Event is not available in ${selectedAddress.city}`
                );
            }
        }

        /**
         * ADDON CITY VALIDATION
         */
        if (draftCartUpdate.addons?.length) {

            console.log("🧩 Addons in Cart:", draftCartUpdate.addons.length);

            for (const addonItem of draftCartUpdate.addons) {

                const addon = addonItem.addonId as any;

                console.log("🔎 Checking Addon:", addon?.name);

                if (addon?.cityOfOperation?.length) {

                    console.log("📍 Addon Cities:", addon.cityOfOperation);

                    const addonCityAllowed = addon.cityOfOperation.some(
                        (c: any) => c.name?.toLowerCase() === selectedCity
                    );

                    console.log(`✅ Addon (${addon?.name}) City Match:`, addonCityAllowed);

                    if (!addonCityAllowed) {

                        console.log(`❌ Addon ${addon?.name} not available in city:`, selectedCity);

                        throw new BadRequestException(
                            `${addon.name} is not available in ${selectedAddress.city}`
                        );
                    }
                }
            }
        }

        /**
         * UPDATE ADDRESS
         */
        console.log("📌 Updating Draft Cart Address");

        draftCartUpdate.addressId = addressId;

        /**
         * PLANNER PRICE
         */
        if (isPlanner === true) {

            console.log("🧠 Planner selected, calculating price...");

            const getPlannerPrice = await this.getPlannerPrice(userId);

            console.log("💰 Planner price result:", getPlannerPrice);

            draftCartUpdate.plannerPrice = getPlannerPrice.plannerPrice;

        } else {

            console.log("🚫 Planner not selected");

            draftCartUpdate.plannerPrice = undefined;
        }

        await draftCartUpdate.save({ validateBeforeSave: true });

        console.log("✅ Address updated successfully");

        return {
            message: 'Update address successfully',
        };
    }
    async upgradeDraftEventTier(
        userId: Types.ObjectId,
        dto: UpdateDraftUpgradeEventTierDto,
    ) {
        const { eventId, selectedTierId } = dto;

        // ------------------------------------
        // 1️⃣ Find draft for this user + event
        // ------------------------------------
        const draft = await this.draftCartModel
            .findOne({ userId, eventId })
            .populate({
                path: 'eventId',
                strictPopulate: false,
            });

        if (!draft) {
            throw new NotFoundException('Draft cart for this event not found');
        }

        // event object populated as: draft.eventId
        const event = draft.eventId as any;

        if (!event) {
            throw new NotFoundException(`Event not found: ${eventId}`);
        }

        // ------------------------------------
        // 2️⃣ Extract tier from event.tiers[]
        // ------------------------------------
        const tier = event.tiers?.find(
            (t: any) => t._id.toString() === selectedTierId.toString(),
        );

        if (!tier) {
            throw new NotFoundException('Tier not found for this event');
        }

        // ------------------------------------
        // 3️⃣ Build tier snapshot
        // ------------------------------------
        const tierSnapshot = {
            _id: new Types.ObjectId(), // snapshot id
            tierId: tier._id,
            name: tier.name,
            price: tier.price,
        };

        // ------------------------------------
        // 4️⃣ Update tier in draft
        // ------------------------------------
        draft.selectedTier = tierSnapshot;

        // ------------------------------------
        // 5️⃣ Save draft (subtotal calculated by pre-save hook)
        // ------------------------------------
        await draft.save({ validateBeforeSave: true });

        // ------------------------------------
        // 6️⃣ Recalculate planner price based on new subtotal
        // ------------------------------------
        if (draft.plannerPrice) {
            draft.plannerPrice = calculatePlannerPriceBySubtotal(draft.subtotal);
            await draft.save({ validateBeforeSave: true });
        }

        return {
            message: 'Draft tier upgraded successfully.',

        };
    }



    // // ─────────── Get Draft Cart By User ───────────
    async getDraftCartByUser(userId: Types.ObjectId) {
        const draftCart: any = await this.draftCartModel
            .findOne({ userId })
            .populate({
                path: 'eventId',
                populate: [{
                    path: 'experientialEventCategory',
                    model: 'DropdownOption', // <-- FIXED
                    strictPopulate: false,
                },
                {
                    path: 'subExperientialEventCategory',
                    model: 'SubExperientialEventCategory', // <-- If applicable
                    strictPopulate: false,
                }],
                strictPopulate: false,
            })
            // .populate({
            //     path: 'eventId',
            //     model: 'AddOn',   // explicitly tell Mongoose to populate as AddOn
            // })
            .populate({
                path: 'addons.addonId',
            })
            .lean()
            .exec();

        if (!draftCart) throw new NotFoundException('No active draft cart found.');
        // console.log("draft cart data in ", JSON.stringify(draftCart))
        // -------------------------------
        // 1️⃣ EVENT TIER SNAPSHOT
        // -------------------------------
        if (draftCart.eventId && draftCart.selectedTier?.tierId) {
            const event: any = draftCart.eventId;
            const tierId = draftCart.selectedTier.tierId.toString();

            const fullTier = event?.tiers?.find(
                (t: any) => t._id.toString() === tierId,
            );

            draftCart.selectedTier.fullTier = fullTier || null;
        }

        // -------------------------------
        // 2️⃣ ADDON TIER SNAPSHOT (hydrate tier details)
        // -------------------------------
        if (draftCart.addons?.length > 0) {
            draftCart.addons = draftCart.addons.map((addon: any) => {
                const addonDoc: any = addon.addonId;
                if (!addonDoc?.tiers || !addon.tiersWithSlot?.length) return addon;

                // Hydrate each tier with full details
                addon.tiersWithSlot = addon.tiersWithSlot.map((tierWithSlot: any) => {
                    const fullTier = addonDoc.tiers.find(
                        (t: any) => t._id.toString() === tierWithSlot.tierId.toString(),
                    );
                    return {
                        ...tierWithSlot,
                        fullTier: fullTier || null,
                    };
                });

                return addon;
            });
        }

        // -------------------------------------
        // 3️⃣ FINAL RESPONSE FORMAT (TypeScript-safe)
        // -------------------------------------
        const formattedResponse = {
            _id: draftCart._id,
            userId: draftCart.userId,
            eventCategory: draftCart.eventCategory || null,
            eventId: draftCart.eventId
                ? {
                    _id: draftCart.eventId._id,
                    title: (draftCart.eventId as any).title,
                    name: (draftCart.eventId as any).name,
                    exclusions: (draftCart.eventId as any).exclusions,
                    ageGroup: (draftCart.eventId as any).ageGroup,
                    createdBy: (draftCart.eventId as any).createdBy,
                    active: (draftCart.eventId as any).active,
                    category: (draftCart.eventId as any).category,
                    experientialEventCategory: draftCart.eventId?.experientialEventCategory?.label,
                    banner: (draftCart.eventId as any).banner,
                    subExperiential: draftCart.eventId?.subExperientialEventCategory?.[0]?.name,
                    discount: (draftCart.eventId as any).discount,
                    addOns: (draftCart.eventId as any).addOns,
                }
                : null,

            eventTitle: draftCart.eventTitle,

            selectedTier: draftCart.selectedTier
                ? {
                    _id: draftCart.selectedTier._id,
                    tierId: draftCart.selectedTier.tierId,
                    name: draftCart.selectedTier.name,
                    price: draftCart.selectedTier.price,
                    fullTier: draftCart.selectedTier.fullTier || null,
                }
                : null,

            addons:
                draftCart.addons?.map((addon: any) => ({
                    addonId: addon.addonId?._id || addon.addonId,
                    addonName: addon.addonId?.name || null,
                    tiersWithSlot: addon.tiersWithSlot?.map((tierWithSlot: any) => ({
                        tierId: tierWithSlot.tierId,
                        tierName: tierWithSlot.fullTier?.name || null,
                        tierPrice: tierWithSlot.fullTier?.price || null,
                        tierFeatures: tierWithSlot.fullTier?.features || [],
                        slots: tierWithSlot.slots || [],
                    })) || [],
                })) || [],

            isCompleted: draftCart.isCompleted,
            subtotal: draftCart.subtotal,
            plannerPrice: draftCart.plannerPrice || undefined,
            createdAt: (draftCart as any).createdAt,
            updatedAt: (draftCart as any).updatedAt,
            eventBookingDate: draftCart.eventBookingDate || null,
            eventDate: draftCart.eventDate || null,
            eventTime: draftCart.eventTime || null,
            addressId: draftCart.addressId
        };

        return formattedResponse;
    }



    /// get upgrade suggestions
    async getUpgradeSuggestions(userId: string) {
        const draftCart = await this.draftCartModel
            .findOne({ userId })
            .populate('userId')
            .populate({
                path: 'eventId',
                strictPopulate: false,
            }).lean()

        if (!draftCart) throw new NotFoundException('Cart not found');
        if (!draftCart.eventId) throw new NotFoundException('Event not found');

        const tiers = (draftCart as any)?.eventId?.tiers ?? [];

        const currentIndex = tiers.findIndex(
            (t: any) => t._id.toString() === draftCart.selectedTier?.tierId.toString(),
        );

        if (currentIndex === -1) throw new NotFoundException('Tier not found');

        const currentTier = tiers[currentIndex];
        const suggestions = tiers.slice(currentIndex + 1).map((t: any) => ({
            _id: t._id,
            name: t.name,
            price: t.price,
            venueSize: t.venueSize,
            description: t.description,
            features: t.features,
            priceDifference: t.price - currentTier.price,
            discount: (draftCart.eventId as any).discount || 0
        }));

        return { upgradeOptions: suggestions, };
    }


    async getPlannerPrice(userId: Types.ObjectId) {
        const draftCart = await this.draftCartModel
            .findOne({ userId })
            .populate('eventId')
            .populate('addons.addonId')
            .lean()
            .exec();

        if (!draftCart) throw new NotFoundException('No active draft cart found.');

        // -------------------------------
        // Cast populated fields safely
        // -------------------------------
        const event = draftCart.eventId as any;     // populated Event object
        const addons = draftCart.addons as any[];   // populated addon documents

        // -------------------------------
        // Helper: find tier by ID
        // -------------------------------
        const findTier = (tiers: any[], id: Types.ObjectId) =>
            tiers?.find((t) => t._id.toString() === id.toString()) || null;

        // -------------------------------
        // 1️⃣ Hydrate EVENT tier snapshot
        // -------------------------------
        if (event && draftCart.selectedTier?.tierId) {
            (draftCart.selectedTier as any).fullTier = findTier(
                event.tiers,
                draftCart.selectedTier.tierId,
            );
        }

        // -------------------------------
        // 2️⃣ Calculate addon total from tiersWithSlot
        // -------------------------------
        let addonTotal = 0;
        for (const addon of addons) {
            const addonDoc = addon.addonId as any;
            if (!addonDoc?.tiers || !addon.tiersWithSlot?.length) continue;

            for (const tierWithSlot of addon.tiersWithSlot) {
                const tier = findTier(addonDoc.tiers, tierWithSlot.tierId);
                if (tier) {
                    const slotMultiplier = tierWithSlot.slots?.reduce(
                        (sum: number, slot: any) => sum + (slot.quantity || 1),
                        0
                    ) || 1;
                    addonTotal += tier.price * slotMultiplier;
                }
            }
        }

        // -------------------------------
        // 3️⃣ Calculate Planner Price
        // -------------------------------
        const basePrice = (draftCart.selectedTier as any)?.fullTier?.price || 0;
        const discount = event?.discount || 0;
        const discountedBase = discount > 0
            ? basePrice - (basePrice * discount) / 100
            : basePrice;
        const subtotal = Math.round(discountedBase + addonTotal);
        const rawPlannerPrice = subtotal * 0.08;
        const plannerPrice = Math.round(rawPlannerPrice);

        return {
            plannerPrice: Math.min(Math.max(plannerPrice, 3000), 15000),
        };


    }

    async bookServiceOnly(
        userId: Types.ObjectId,
        dto: UpdateDraftAddonsDto,
    ) {
        const { addons = [], eventDate, city } = dto;

        if (!addons.length) {
            throw new BadRequestException('addons required');
        }

        const mainAddonId = addons[0].addonId;
        const mainAddon = await this.addOnService.getAddonById(mainAddonId.toString());

        if (!mainAddon) throw new NotFoundException('Service is not available');
        console.log("main addons data ", mainAddon)

        if (!city) {
            throw new BadRequestException('City is required');
        }

        if (!eventDate) {
            throw new BadRequestException('Event date is required');
        }
        // const checkAvailability =
        //     await this.vendorBookingService.getAddonAvailableSlots({
        //         eventId: new Types.ObjectId(mainAddonId),
        //         city,
        //         date: eventDate,
        //     });
        const eventBookingDate = mergeDateAndTime(eventDate, "00:00 PM");
        let draft = await this.draftCartModel.findOne({ userId });

        // ----------------------------------
        // If draft exists
        // ----------------------------------
        if (draft) {

            // Convert to AddOn mode if needed
            if (draft.eventCategory !== 'AddOn') {
                draft.eventCategory = 'AddOn';
                draft.selectedTier = undefined;
                draft.assignVendor = undefined;
                draft.eventTime = undefined;
                draft.eventBookingDate = undefined;

            }

            // ✅ REMOVE ALL OLD ADDONS
            draft.addons = [];
            draft.eventTitle = mainAddon.name
            draft.eventId = mainAddonId;
            draft.city = city;
            draft.eventDate = eventDate;
            draft.eventBookingDate = eventBookingDate
        }

        // ----------------------------------
        // Create new draft if not exists
        // ----------------------------------
        if (!draft) {
            draft = await this.draftCartModel.create({
                userId,
                eventCategory: 'AddOn',
                eventId: mainAddonId,
                eventDate,
                eventBookingDate,
                city,
                addons: [],
            });
        }

        // ----------------------------------
        // Insert NEW addons only
        // ----------------------------------
        for (const input of addons) {
            const addOn = await this.addOnService.getAddOnDetailsByAdmin(
                input.addonId.toString(),
            );

            if (!addOn) throw new BadRequestException('Addon not found');

            const tiers: TierWithSlot[] = [];

            for (const tierInput of input.tiersWithSlot || []) {
                const tier = addOn.tiers.find(
                    t => t._id.toString() === tierInput.tierId.toString(),
                );

                if (!tier) throw new BadRequestException('Invalid tier');

                tiers.push({
                    tierId: tier._id,
                    name: tier.name,
                    price: tier.price,
                    discount: tier.discount ?? 0,
                    features: tier.features ?? [],
                    slots: (tierInput.slots || []).map(s => ({
                        slotType: s.slotType,
                        quantity: s.quantity || 1,
                    })),
                });
            }

            draft.addons.push({
                addonId: addOn._id,
                banner: addOn.banner || [],
                assignAddonVendor: addOn.createdBy ?? null,
                tiersWithSlot: tiers,
            });
        }

        await draft.save();
        return draft;
    }





}
