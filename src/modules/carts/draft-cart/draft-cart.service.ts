import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DraftCartItem, DraftCartItemDocument } from './draft-cart.schema';
import { AddToDraftDto } from './dto/add-to-draft.dto';
import { UpdateDraftScheduleDto } from './dto/update-draft-schedule.dto';
import { UpdateDraftAddonsDto } from './dto/update-draft-addon.dto';
import { UpdateDraftAddressDto } from './dto/update-draft-address.dto';
import { UpdateDraftUpgradeEventTierDto } from './dto/upgrade-draft-event-tier.dto'
import { mergeDateAndTime } from '../../../common/utils/mergeDateAndTime';
import { AddOnService } from '../../addOn/addon.service';
import { calculateDraftCartSubtotal } from './utils/calc-subtotal.util'
import { calculatePlannerPriceBySubtotal } from './utils/calc-planner-price.util'
// Event Models
import { BirthdayEvent } from '../../birthdayevent/birthdayevent.schema';
import { ExperientialEvent } from '../../experientialevent/experientialevent.schema';
import { AddOn } from '../../addOn/addon.schema';

@Injectable()
export class DraftCartService {
    private readonly logger = new Logger(DraftCartService.name);

    constructor(
        @InjectModel(DraftCartItem.name)
        private readonly draftCartModel: Model<DraftCartItemDocument>,

        @InjectModel(BirthdayEvent.name)
        private readonly birthdayEvent: Model<any>,

        @InjectModel(ExperientialEvent.name)
        private readonly experienceEvent: Model<any>,


        @InjectModel(AddOn.name)
        private readonly addon: Model<any>,

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
        console.log("dto data in draft service", dto)
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
            draft.assignVendor = event.createdBy || null
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
        const { eventDate, eventTime } = dto;

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
        const { addons: incomingAddons } = dto;

        // -----------------------------------------
        // 1️⃣ Fetch draft
        // -----------------------------------------
        const draft = await this.draftCartModel
            .findOne({ userId })
            .populate({
                path: 'eventId',
                strictPopulate: false,
            });

        if (!draft) {
            throw new NotFoundException('No active draft cart found.');
        }

        // -----------------------------------------
        // 2️⃣ Validate input array
        // -----------------------------------------
        if (!Array.isArray(incomingAddons)) {
            throw new BadRequestException('addons must be an array.');
        }

        // If no addons sent => remove all addons (user deselected all)
        const incomingIds = incomingAddons.map(a => a.addonId.toString());

        // -----------------------------------------
        // 3️⃣ REMOVE addons that are NOT in incoming list
        // -----------------------------------------
        draft.addons = draft.addons.filter(existing =>
            incomingIds.includes(existing.addOnId.toString())
        );

        // -----------------------------------------
        // 4️⃣ ADD / UPDATE addons
        // -----------------------------------------
        for (const addonInput of incomingAddons) {
            const { addonId, tierId } = addonInput;

            // Fetch addon from DB
            const addOn = await this.addOnService.getAddOnDetailsByAdmin(
                addonId.toString(),
            );

            if (!addOn) {
                throw new BadRequestException(`Addon not found: ${addonId}`);
            }

            // Find specific tier
            const selectedTier = addOn.tiers.find(
                (t) => t._id.toString() === tierId.toString(),
            );

            if (!selectedTier) {
                throw new BadRequestException(
                    `Invalid tier selected for addon: ${addonId}`,
                );
            }

            // Snapshot structure
            const snapshot = {
                _id: new Types.ObjectId(),
                name: addOn.name,
                addOnId: addOn._id,
                assignAddonVendor: addOn.createdBy,
                selectedTier: {
                    tierId: selectedTier._id,
                    name: selectedTier.name,
                    price: selectedTier.price,
                },
            };

            // Check if exists
            const existingIdx = draft.addons.findIndex(
                (a) => a.addOnId.toString() === addonId.toString(),
            );

            if (existingIdx !== -1) {
                // update tier
                draft.addons[existingIdx].selectedTier = snapshot.selectedTier;
            } else {
                // add new addon
                draft.addons.push(snapshot);
            }
        }

        // -----------------------------------------
        // 5️⃣ Recalculate subtotal
        // -----------------------------------------
        const basePrice = draft.selectedTier?.price || 0;
        const addonTotal = draft.addons.reduce(
            (sum, a) => sum + (a?.selectedTier?.price || 0),
            0,
        );

        draft.subtotal = basePrice + addonTotal;

        // pre-save hook applies event discount automatically

        // -----------------------------------------
        // 6️⃣ Save
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

        const draftCartUpdate = await this.draftCartModel
            .findOne({ userId }).populate('userId')
        // .populate({
        //     path: 'eventId',
        //     strictPopulate: false,
        // });
        if (!draftCartUpdate) throw new NotFoundException('No active draft cart found.');
        const user = draftCartUpdate.userId as any; // or define a User interface
        if (user.addresses.length < 1) throw new NotFoundException('Please add address.');
        const selectedAddress = user.addresses?.find(
            (addr: any) => addr._id.toString() === addressId.toString()
        );
        console.log("selectAddress data", selectedAddress)
        if (!selectedAddress) throw new BadRequestException("Address incorrect")
        draftCartUpdate.addressId = addressId

        if (isPlanner == true) {
            let getPlannerPrice = await this.getPlannerPrice(userId)
            console.log("planner price calculate", getPlannerPrice)
            draftCartUpdate.plannerPrice = getPlannerPrice.plannerPrice
        } else {
            draftCartUpdate.plannerPrice = undefined
        }
        await draftCartUpdate.save({ validateBeforeSave: true })

        return {
            message: 'Update address successfully',
        }

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
        // 5️⃣ Recalculate subtotal
        // ------------------------------------

        console.log("new updated data of tiers", tierSnapshot, event.addons, event.discount)
        let recalculateSubTotal = await calculateDraftCartSubtotal(tierSnapshot, event.addons, event.discount)
        if (draft.plannerPrice) {
            draft.plannerPrice = calculatePlannerPriceBySubtotal(recalculateSubTotal)
        }
        // Discount applied by pre-save hook

        // ------------------------------------
        // 6️⃣ Save draft
        // ------------------------------------
        await draft.save({ validateBeforeSave: true });

        return {
            message: 'Draft tier upgraded successfully.',

        };
    }



    // // ─────────── Get Draft Cart By User ───────────
    async getDraftCartByUser(userId: Types.ObjectId) {
        console.log("userId in draft in data service", userId)
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
                path: 'addons.addOnId',
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
        // 2️⃣ ADDON TIER SNAPSHOT
        // -------------------------------
        if (draftCart.addons?.length > 0) {
            draftCart.addons = draftCart.addons.map((addon: any) => {
                if (!addon.selectedTier?.tierId) return addon;

                const addonDoc: any = addon.addOnId;
                if (!addonDoc?.tiers) return addon;

                const tierId = addon.selectedTier.tierId.toString();

                const fullAddonTier = addonDoc.tiers.find(
                    (t: any) => t._id.toString() === tierId,
                );

                addon.selectedTier.fullSelectedAddonTier = fullAddonTier || null;

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
                    _id: addon._id,
                    addOnId: addon.addOnId._id,
                    name: addon.name,
                    selectedTier: addon.selectedTier
                        ?
                        // _id: addon.selectedTier._id,
                        // tierId: addon.selectedTier.tierId,
                        // name: addon.selectedTier.name,
                        // price: addon.selectedTier.price,
                        // fullSelectedAddonTier:
                        addon.selectedTier.fullSelectedAddonTier || null

                        : null,
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
            guest: t.guest,
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
            .populate('addons.addOnId')
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
        // 2️⃣ Hydrate ADDON tiers
        // -------------------------------
        draftCart.addons = addons.map((addon) => {
            const addonDoc = addon.addOnId as any;

            if (addon.selectedTier?.tierId && addonDoc?.tiers) {
                (addon.selectedTier as any).fullSelectedAddonTier = findTier(
                    addonDoc.tiers,
                    addon.selectedTier.tierId,
                );
            }

            return addon;
        });

        // -------------------------------
        // 3️⃣ Clean final response
        // -------------------------------
        const response = {
            ...draftCart,
            eventId: event
                ? {
                    _id: event._id,
                    title: event.title,
                    ageGroup: event.ageGroup,
                    active: event.active,
                    discount: event.discount,
                    addOns: event.addOns,
                }
                : null,

            addons: draftCart.addons.map((addon: any) => ({
                _id: addon._id,
                addOnId: addon.addOnId
                    ? {
                        _id: addon.addOnId._id,
                        name: addon.addOnId.name,
                        popular: addon.addOnId.popular,
                    }
                    : null,
                name: addon.name,
                selectedTier: addon.selectedTier,
            })),
        };

        // -------------------------------
        // 4️⃣ Calculate Planner Price
        // -------------------------------
        const subtotal = calculateDraftCartSubtotal(
            (response.selectedTier as any)?.fullTier,
            response.addons as any[],
            (draftCart.eventId as any).discount
        );
        // console.log("sub Total", subtotal)
        const rawPlannerPrice = subtotal * 0.08;
        const plannerPrice = Math.round(rawPlannerPrice);

        return {
            plannerPrice: Math.min(Math.max(plannerPrice, 3000), 15000),
        };


    }




}
