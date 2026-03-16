import {
    Injectable,
    Logger,
    BadRequestException, InternalServerErrorException,
    NotFoundException,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { UserDocument } from "../users/users.schema"
import { CartItem, CartItemDocument, CartItemSchema } from './cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import mongoose from 'mongoose'
// Event Models
import { BirthdayEvent, BirthdayEventDocument } from '../birthdayevent/birthdayevent.schema';
import { ExperientialEvent } from '../experientialevent/experientialevent.schema';
import { AddOn } from '../addOn/addon.schema';
import { UpdateCartItemScheduleDto } from './dto/update-cart-item-schedule.dto'
import { UpdateAddonInCartDto } from './dto/update-addon-cart.dto'
import { mergeDateAndTime } from '../../common/utils/mergeDateAndTime'
import { AddOnService } from '../addOn/addon.service'
import { DraftCartItem, DraftCartItemDocument } from './draft-cart/draft-cart.schema';
import { DraftToCartMapper } from './mappers/draft-to-cart.mapper'
import { calculateItemSubtotal as calcItemSubtotal, calculateCartTotal } from './utils/cart-price.utils';
import { length } from 'class-validator';
import { addIntegration } from '@sentry/node';
type AdminGetOpts = {
    page: number;
    limit: number;
    include: 'summary' | 'full';
};

@Injectable()
export class CartService {
    private readonly logger = new Logger(CartService.name);

    constructor(
        // ✅ FIXED → use "CartItem" instead of Cart.name

        @InjectModel(CartItem.name)
        private readonly cartModel: Model<CartItemDocument>,
        @InjectModel(DraftCartItem.name)
        private readonly draftCartModel: Model<DraftCartItemDocument>,

        @InjectModel(BirthdayEvent.name)
        private readonly birthdayEvent: Model<any>,

        @InjectModel(ExperientialEvent.name)
        private readonly experienceEvent: Model<any>,
        @InjectModel(AddOn.name)
        private readonly addon: Model<any>,

        @InjectModel(AddOn.name)
        private readonly serviceEvent: Model<any>,

        @Inject(forwardRef(() => AddOnService))
        private readonly addOnService: AddOnService,

    ) {
        this.logger.debug(`mongoose models: ${mongoose.modelNames().join(', ')}`);
    }

    /**
     * 🔍 Pick correct Event model based on category
     */
    private getEventModel(category: string) {
        switch (category) {
            case 'BirthdayEvent':
                return this.birthdayEvent;

            case 'ExperientialEvent':   // MUST match the schema enum + model name
                return this.experienceEvent;
            case 'AddOn':   // MUST match the schema enum + model name
                return this.addon;

            default:
                throw new BadRequestException(`Invalid event category: ${category}`);
        }
    }


    /**
     * 🛒 Add Event to Cart
     */
    async addToCart(
        userId: Types.ObjectId,
        dto: AddToCartDto,
    ): Promise<{ message: string; item: any }> {

        const { eventCategory, eventId, selectedTierId } = dto;

        if (!eventCategory || !eventId || !selectedTierId) {
            throw new BadRequestException(
                'eventCategory, eventId, and selectedTierId are required.',
            );
        }

        // 1️⃣ Fetch Event
        const EventModel = this.getEventModel(eventCategory);
        const event = await EventModel.findById(eventId);
        if (!event) throw new NotFoundException(`Event not found: ${eventId}`);

        // 2️⃣ Extract Tier
        const tier = event.tiers?.find(
            (t) => t._id.toString() === selectedTierId.toString(),
        );
        if (!tier) throw new NotFoundException(`Tier not found`);

        // 3️⃣ Get or Create Cart
        let cart = await this.cartModel.findOne({ userId });
        if (!cart) {
            cart = new this.cartModel({
                userId,
                items: [],
                totalAmount: 0,
                status: 'active',
            });
        }

        if (!Array.isArray(cart.items)) cart.items = [];

        // 4️⃣ Tier Snapshot
        const tierSnapshot = {
            tierId: tier._id,
            name: tier.name,
            price: tier.price,
        };

        // 5️⃣ Add or Update Item
        let message: 'added' | 'updated' = 'added';
        let modifiedItem: any;

        const existingItem = cart.items.find(
            (i) => i.eventId.toString() === eventId.toString(),
        );

        if (existingItem) {
            existingItem.selectedTier = tierSnapshot;
            existingItem.eventTitle = event.title;
            existingItem.eventCategory = eventCategory;
            existingItem.eventBookingDate = new Date();

            message = 'updated';
            modifiedItem = existingItem;
        } else {

            // Fetch default user address (optional)


            const newItem = {
                _id: new Types.ObjectId(),
                eventCategory,
                eventId,
                eventTitle: event.title,
                selectedTier: tierSnapshot,
                assignVendor: event.createdBy,
                date: new Date(),
                addons: [],

                // 👇 Fix: must be undefined or Date
                eventBookingDate: undefined,

                // 👇 Fix: must match AddressSnapshot type
                addressDetails: {
                    name: "xyz",
                    address: "indore",
                    street: "7",
                    isDefault: false,
                    landMark: "indore",
                    mobile: 1234567890,
                    city: "indore",
                    state: "MP",
                    pincode: 452001,
                    addressType: "home",
                    companyName: "xyz",
                    gstin: "k",
                    latitude: 1,
                    longitude: 3,
                },

                subtotal: 0,
                plannerPrice: 0,
            };

            cart.items.push(newItem);
            modifiedItem = newItem;
            message = 'added';
        }

        // 6️⃣ Recalculate Total
        cart.totalAmount = cart.items.reduce(
            (sum, item) => sum + (item.selectedTier?.price || 0),
            0,
        );

        // 7️⃣ Save Cart
        await cart.save();

        // 8️⃣ Return only modified item
        return { message, item: modifiedItem };
    }



    async updateEventSchedule(
        userId: Types.ObjectId,
        dto: UpdateCartItemScheduleDto,
    ) {
        const { cartItemId, eventDate, eventTime } = dto;

        // 1️⃣ Find cart
        const cart = await this.cartModel.findOne({
            userId,
            status: 'active',
        })
            .populate("userId")
            .populate({
                path: 'items.eventId',
                strictPopulate: false,
            })
            .exec();

        if (!cart) throw new NotFoundException('Cart not found.');

        // 2️⃣ Find cart item
        const cartItem = cart.items.find(
            (i) => i._id.toString() === cartItemId.toString(),
        );
        if (!cartItem) throw new NotFoundException('Cart item not found.');

        // 3️⃣ Validate fields
        if (!eventDate || !eventTime)
            throw new BadRequestException('Event date & time are required.');

        // 4️⃣ Try to safely read user's address
        const user = cart.userId as any;
        let selectedAddress: any | null = null;

        if (cartItem.addressId) {
            selectedAddress = user.addresses?.find(
                (addr: any) =>
                    addr._id.toString() === cartItem.addressId?.toString()
            ) || null;
        }

        // 5️⃣ Merge schedule
        const eventBookingDate = mergeDateAndTime(eventDate, eventTime);

        cartItem.eventDate = eventDate;
        cartItem.eventTime = eventTime;
        cartItem.eventBookingDate = eventBookingDate;

        // 6️⃣ Create day range for availability check
        const startOfDay = new Date(eventDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(eventDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // 7️⃣ Check availability if address & city exist
        const event: any = cartItem.eventId;

        if (selectedAddress?.city && Array.isArray(event?.city)) {
            const checkIsAvailable = await this.cartModel.countDocuments({
                'items.eventId': cartItem.eventId,
                'items.eventBookingDate': { $gte: startOfDay, $lte: endOfDay },
                'items.eventAddress.city': selectedAddress.city,
            });

            const maxBookings = event.city.find(
                (c: any) => c.name === selectedAddress.city
            )?.maxBookingsPerDay;

            if (maxBookings && checkIsAvailable >= maxBookings) {
                throw new BadRequestException(
                    'Selected date is fully booked. Choose another date.'
                );
            }
        }

        // 8️⃣ Save cart
        await cart.save();

        // 9️⃣ Return ONLY updated item
        return {
            message: "Schedule updated successfully",
            item: {
                cartItemId: cartItem._id,
                eventId: cartItem.eventId,
                eventDate: cartItem.eventDate,
                eventTime: cartItem.eventTime,
                eventBookingDate: cartItem.eventBookingDate,
            }
        };
    }


    // async getFullCartByUser(userId: Types.ObjectId) {
    //     const cart = await this.cartModel
    //         .findOne({ userId, status: 'active' })
    //         // .populate('userId')
    //         .populate({
    //             path: 'items.eventId',
    //             strictPopulate: false,
    //         })
    //         .populate({
    //             path: 'items.addons.addonId',
    //         })
    //         .lean()
    //         .exec();

    //     if (!cart) {
    //         throw new NotFoundException('No active cart found.');
    //     }

    //     // -----------------------------
    //     // 1️⃣ ADD EVENT TIER SNAPSHOT
    //     // -----------------------------
    //     cart.items = cart.items.map((item: any) => {
    //         if (item.eventId && item.selectedTier?.tierId) {
    //             const tierId = item.selectedTier.tierId.toString();

    //             const fullTier = item.eventId.tiers?.find(
    //                 (t) => t._id.toString() === tierId,
    //             );

    //             item.selectedTier.fullTier = fullTier || null;
    //         }

    //         return item;
    //     });

    //     // -----------------------------
    //     // 2️⃣ ADD ADDON TIER SNAPSHOT
    //     // -----------------------------
    //     cart.items = cart.items.map((item: any) => {
    //         if (!item.addons || item.addons.length === 0) return item;

    //         item.addons = item.addons.map((addon: any) => {
    //             if (!addon.selectedTier?.tierId) return addon;
    //             if (!addon.addOnId?.tiers) return addon;

    //             const tierId = addon.selectedTier.tierId.toString();

    //             // Find matching tier inside addOnId.tiers
    //             const fullSelectedAddonTier = addon.addOnId.tiers.find(
    //                 (t) => t._id.toString() === tierId,
    //             );

    //             addon.selectedTier.fullSelectedAddonTier =
    //                 fullSelectedAddonTier || null;

    //             return addon;
    //         });

    //         return item;
    //     });




    //     return {
    //         success: true,
    //         message: 'Cart fetched successfully.',
    //         data: cart,
    //     };
    // }

    async getFullCartByUser(userId: Types.ObjectId) {
        const cart = await this.cartModel
            .findOne({ userId, status: 'active' })
            .populate('userId')
            .populate({
                path: 'items.eventId',
                populate: [
                    { path: 'experientialEventCategory', strictPopulate: false },
                    { path: 'subExperientialEventCategory', strictPopulate: false },
                ],
                strictPopulate: false,
            })
            .populate({
                path: 'items.addons.addonId',
            })
            .lean()
            .exec();

        if (!cart) {
            throw new NotFoundException('No active cart found.');
        }

        // -------------------------------------------------------
        // SAFE SORT ITEMS BY createdAt (LATEST FIRST)
        // -------------------------------------------------------
        if (Array.isArray(cart.items)) {
            cart.items = cart.items.sort((a: any, b: any) => {
                const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bTime - aTime;
            });
        }

        const user: any = cart.userId;
        const userAddresses = user?.addresses || [];

        // -------------------------------------------------------
        // MAP ITEMS — SINGLE LOOP (clean, predictable)
        // -------------------------------------------------------
        const formattedItems = cart.items.map((item: any) => {
            const address = userAddresses.find(
                (a: any) => String(a._id) === String(item.addressId)
            );

            // Full tier snapshot for main event
            let fullTier = null;
            if (item.eventId && item.selectedTier?.tierId) {
                fullTier =
                    item.eventId.tiers?.find(
                        (t: any) =>
                            String(t._id) === String(item.selectedTier.tierId),
                    ) || null;
            }

            // Addon tier snapshots (simplified structure)
            const formattedAddons = (item.addons || []).map((addon: any) => {
                const addonDoc = addon.addonId;

                // Hydrate tiers with full details
                const tiersWithSlot = (addon.tiersWithSlot || []).map((tierWithSlot: any) => {
                    const fullTier = addonDoc?.tiers?.find(
                        (t: any) => String(t._id) === String(tierWithSlot.tierId)
                    ) || null;

                    return {
                        tierId: tierWithSlot.tierId,
                        tierName: fullTier?.name || null,
                        tierPrice: fullTier?.price || null,
                        tierFeatures: fullTier?.features || [],
                        slots: tierWithSlot.slots || [],
                    };
                });

                return {
                    id: addon._id,
                    addonId: addonDoc?._id || addon.addonId,
                    addonName: addonDoc?.name || null,
                    banner: addonDoc?.banner?.[0] || null,
                    tiersWithSlot,
                };
            });

            // Final item structure
            return {
                _id: item._id,
                userId: user._id,
                eventCategory: item.eventCategory || null,

                eventId: item.eventId
                    ? {
                        _id: item.eventId._id,
                        title: item.eventId.title,
                        ageGroup: item.eventId.ageGroup,
                        experientialEventCategory:
                            item.eventId?.experientialEventCategory?.label ||
                            null,
                        subExperientialEventCategory:
                            item.eventId?.subExperientialEventCategory?.[0]
                                ?.name || null,
                        duration: item.eventId.duration,
                        discount: item.eventId.discount,
                        banner: item.eventId.banner || [],
                    }
                    : null,

                eventTitle: item.eventTitle,
                selectedTier: fullTier,
                isCheckOut: item.isCheckOut === 1,
                plannerPrice:
                    item.plannerPrice && item.plannerPrice > 0
                        ? item.plannerPrice
                        : undefined,
                addons: formattedAddons,

                isCompleted: item.isCompleted,
                addressId: address || null,
                subtotal: item.subtotal || 0,

                createdAt: item.createdAt || null,
                updatedAt: item.updatedAt || null,

                eventBookingDate: item.eventBookingDate || null,
                eventDate: item.eventDate || null,
                eventTime: item.eventTime || null,
            };
        });

        // -------------------------------------------------------
        // FINAL RESULT
        // -------------------------------------------------------
        return {
            success: true,
            message: 'Cart fetched successfully.',
            data: {
                _id: cart._id,
                userId: user._id,
                totalAmount: cart.totalAmount,
                status: cart.status,
                termsAccepted: cart.termsAccepted ?? false,
                items: formattedItems,
            },
        };
    }




    async updateAddonInCartByUser(
        userId: Types.ObjectId,
        dto: UpdateAddonInCartDto,
    ) {
        const { cartItemId, addonId, tierId, remove } = dto;

        if (!addonId) {
            throw new BadRequestException('addonId is required.');
        }

        // 1️⃣ Fetch active cart
        const cart = await this.cartModel
            .findOne({ userId, status: 'active' })
            .populate({
                path: 'items.eventId',
                strictPopulate: false,
            })
            .exec();

        if (!cart) throw new NotFoundException('No active cart found.');

        // 2️⃣ Find single cart item
        const cartItem = cart.items.find(
            (it) => it?._id?.toString() === cartItemId?.toString(),
        );

        if (!cartItem) {
            throw new NotFoundException('Cart item not found.');
        }

        const event: any = cartItem.eventId;
        if (!event) {
            throw new BadRequestException('Event data missing for this cart item.');
        }

        // 3️⃣ Fetch addon from AddOn collection
        const addOn = await this.addOnService.getAddOnDetailsByAdmin(
            addonId.toString(),
        );

        if (!addOn) {
            throw new BadRequestException('Addon not found.');
        }

        console.log('Fetched AddOn:', addOn);

        // 4️⃣ Remove addon
        if (remove === true) {
            cartItem.addons = cartItem.addons.filter(
                (a) => a?.addonId?.toString() !== addonId.toString(),
            );

            await cart.save();
            return { message: 'Addon removed successfully.' };
        }

        // 5️⃣ Validate Tier
        const selectedTier = addOn.tiers?.find(
            (t) => t?._id?.toString() === tierId?.toString(),
        );

        if (!selectedTier) {
            throw new BadRequestException('Invalid tier selected.');
        }

        // 6️⃣ Prepare Tier Snapshot (Schema Safe)
        const tierSnapshot = {
            tierId: selectedTier._id,
            name: selectedTier.name,
            price: selectedTier.price,
            discount: selectedTier.discount ?? 0,
            features: selectedTier.features ?? [],
            slots: [],
        };

        // 7️⃣ Check if addon already exists
        const existingIndex = cartItem.addons.findIndex(
            (ad) => ad?.addonId?.toString() === addonId.toString(),
        );

        if (existingIndex !== -1) {
            // Update existing addon tier
            const existingTierIndex = cartItem.addons[existingIndex].tiersWithSlot.findIndex(
                (tw) => tw.tierId?.toString() === selectedTier._id.toString(),
            );

            if (existingTierIndex !== -1) {
                // Tier exists → update snapshot, preserve slots
                cartItem.addons[existingIndex].tiersWithSlot[existingTierIndex] = {
                    ...tierSnapshot,
                    slots:
                        cartItem.addons[existingIndex].tiersWithSlot[existingTierIndex].slots || [],
                };
            } else {
                // Add new tier to existing addon
                cartItem.addons[existingIndex].tiersWithSlot.push(tierSnapshot);
            }
        } else {
            // Add new addon with tier snapshot
            cartItem.addons.push({
                addonId: addOn._id,
                banner: addOn.banner || [],
                assignAddonVendor: addOn.createdBy ?? undefined,
                tiersWithSlot: [tierSnapshot],
            });
        }

        // 8️⃣ Save cart
        await cart.save();

        return {
            message: 'Addon updated successfully.',
            data: cart,
        };
    }



    async getCartItemById(itemId: string, userId: Types.ObjectId,) {
        const cart = await this.cartModel
            .findOne({ userId, status: 'active' })
            .populate('userId')
            .populate({
                path: 'items.eventId',
                strictPopulate: false,
            })
            .populate({
                path: 'items.addons.addonId',
            })
            .lean()
            .exec();

        if (!cart) throw new NotFoundException('No active cart found.');

        // 1️⃣ Extract cart item
        const cartItem: any = cart.items.find(
            (i: any) => i._id.toString() === itemId.toString(),
        );

        if (!cartItem) {
            throw new NotFoundException('Cart item not found.');
        }

        console.log(" selected cartItem", cartItem)

        // 2️⃣ EVENT FULL TIER SNAPSHOT
        if (cartItem.eventId && cartItem.selectedTier?.tierId) {
            const event: any = cartItem.eventId;   // <-- FIX TypeScript
            const tierId = cartItem.selectedTier.tierId.toString();

            const fullTier = event.tiers?.find(
                (t: any) => t._id.toString() === tierId.toString(),
            );

            (cartItem.selectedTier as any).fullTier = fullTier || null;
        }

        // 3️⃣ ADDON TIER SNAPSHOT (hydrate tier details)
        if (cartItem.addons && cartItem.addons.length > 0) {
            cartItem.addons = cartItem.addons.map((addon: any) => {
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

        return cartItem;
    }



    async getCartByUserForAdmin(userId: Types.ObjectId, opts: AdminGetOpts) {
        const { page, limit, include } = opts;
        const skip = (page - 1) * limit;

        // 1) Fetch cart
        const cart = await this.cartModel
            .findOne({ userId, status: 'active' })
            .populate('userId')
            .populate({
                path: 'items.eventId',
                strictPopulate: false,
            })
            .populate({
                path: 'items.addons.addonId',
            })
            .exec(); // DO NOT USE LEAN

        if (!cart) {
            throw new NotFoundException('No cart found for the given user');
        }

        // 2) Paginate items INSIDE document
        const totalItems = cart.items?.length ?? 0;
        const paginatedItems = cart.items.slice(skip, skip + limit);

        // 3) Hydrate full tier info ONLY if include = "full"
        if (include === 'full') {
            for (const item of paginatedItems) {
                // ------------------------------
                // A) EVENT SELECTED TIER DETAILS
                // ------------------------------
                const tierId = item?.selectedTier?.tierId?.toString();

                if (tierId && item.eventId && (item.eventId as any).tiers) {
                    const eventDoc: any = item.eventId; // populated event document

                    const fullTier = eventDoc.tiers.find(
                        (t: any) => t._id.toString() === tierId,
                    );

                    (item.selectedTier as any).fullTier = fullTier || null;
                } else {
                    (item.selectedTier as any).fullTier = null;
                }

                // ------------------------------
                // B) ADDONS TIER DETAILS (hydrate)
                // ------------------------------
                if (Array.isArray(item.addons)) {
                    for (const addon of item.addons) {
                        const addonDoc: any = addon.addonId; // populated addon document

                        if (addonDoc?.tiers && addon.tiersWithSlot?.length) {
                            addon.tiersWithSlot = addon.tiersWithSlot.map((tierWithSlot: any) => {
                                const fullTier = addonDoc.tiers.find(
                                    (t: any) => t._id.toString() === tierWithSlot.tierId?.toString(),
                                );
                                return {
                                    ...tierWithSlot,
                                    fullTier: fullTier || null,
                                };
                            });
                        }
                    }
                }
            }
        }

        return {
            success: true,
            message: 'Cart fetched successfully.',
            data: {
                cartId: cart._id,
                user: cart.userId._id,
                items: paginatedItems,
                totalAmount: cart.totalAmount,
                status: cart.status,
                meta: {
                    page,
                    limit,
                    totalItems,
                },
            },
        };
    }



    //
    // --------------------------------------------
    //   ADD TO CART FROM DRAFT
    // --------------------------------------------
    //
    async addFromDraftCart(
        draftId: string,
        userId: Types.ObjectId,
        forceUpdate: boolean = false,   // <- NEW
    ) {
        // 1️⃣ Fetch Draft
        let draft = await this.draftCartModel.findOne({
            _id: new Types.ObjectId(draftId),
            userId
        }).populate('userId');

        if (!draft) throw new NotFoundException('Draft cart not found');

        // Validations
        if (draft.eventCategory !== 'AddOn' && !draft.selectedTier) {
            throw new BadRequestException('Tier selection required');
        }

        if (!draft.addressId) {
            throw new BadRequestException('Address selection required');
        }
        if (!draft.eventDate) {
            throw new BadRequestException('Event date & time required');
        }
        draft.addressDetails = (draft.userId as any).addresses.find(
            (addr: any) => addr._id.toString() === draft!.addressId?.toString()
        ) || null;


        console.log("draft cart item to be added to cart", draft)
        // Convert draft → cart item
        const incomingItem = DraftToCartMapper.toCartItem(draft);

        // 2️⃣ Fetch active cart
        let cart = await this.cartModel.findOne({ userId, status: 'active' });

        if (!cart) {
            cart = await this.cartModel.create({
                userId,
                items: [],
            });
        }

        // 3️⃣ Check if same eventId exists already
        const existingIndex = cart.items.findIndex(
            (item) => item.eventId.toString() === incomingItem.eventId.toString()
        );

        // Calculate subtotal for incoming item using utility
        incomingItem.subtotal = calcItemSubtotal(incomingItem);
console.log("calsulate sub totel", calcItemSubtotal(incomingItem))
        // ----------------------------
        // CASE A: Event exists
        // ----------------------------
        if (existingIndex !== -1) {
            const existingItem = cart.items[existingIndex];

            // If force update = false → ask frontend for confirmation
            if (!forceUpdate) {
                throw new BadRequestException('Do you want to update  item.... .');
            }

            // ----------- FORCE UPDATE LOGIC -------------
            // Replace the existing cart item except _id
            cart.items[existingIndex] = Object.assign(
                {},
                existingItem,
                incomingItem,
            );

            // Recalculate cart total
            cart.totalAmount = calculateCartTotal(cart.items);

            await cart.save({ validateBeforeSave: true });

            return {
                updated: true,
                replacedExistingItem: true,
                message: 'Existing event updated in cart successfully.',
                data: cart,
            };
        }
        incomingItem.createdAt = new Date();
        incomingItem.updatedAt = new Date();
        // ----------------------------
        // CASE B: No event found → Add new item
        // ----------------------------
        cart.items.push(incomingItem);

        // Recalculate cart total
        cart.totalAmount = calculateCartTotal(cart.items);

        await cart.save({ validateBeforeSave: true });

        return {
            updated: true,
            addedNewItem: true,
            message: 'Event added to cart successfully.',
            data: cart,
        };
    }




    async toggleCartItemCheckout(
        userId: Types.ObjectId,
        cartItemId: Types.ObjectId,
    ): Promise<string> {
        // Atomic toggle using $bit XOR
        const updatedCart = await this.cartModel.findOneAndUpdate(
            {
                userId,
                'items._id': cartItemId,
            },
            {
                $bit: {
                    'items.$.isCheckOut': { xor: 1 },
                },
            } as any,
            { new: true },
        );

        if (!updatedCart) {
            throw new NotFoundException('Cart item not found or invalid user.');
        }

        return 'Successfully toggled checkout status';
    }


    async deleteCartItem(userId: Types.ObjectId, cartItemId: Types.ObjectId) {
        if (!Types.ObjectId.isValid(String(userId)) || !Types.ObjectId.isValid(String(cartItemId))) {
            throw new BadRequestException('Invalid identifiers provided.');
        }

        // Try to use a transaction if the driver supports it (replica set)
        let session: ClientSession | null = null;
        try {
            session = await this.startSessionIfSupported();

            if (session) {
                session.startTransaction();
            }

            // load cart inside session to ensure we operate on latest snapshot
            const cart = await this.cartModel.findOne({ userId, status: 'active' }).session(session ?? null);
            if (!cart) {
                if (session) await session.abortTransaction();
                throw new NotFoundException('No active cart found for user.');
            }

            // find item index
            const idx = cart.items.findIndex((it: any) => it._id?.toString() === cartItemId.toString());
            if (idx === -1) {
                if (session) await session.abortTransaction();
                throw new NotFoundException('Cart item not found.');
            }

            // remove the item
            const removed = cart.items.splice(idx, 1)[0];

            // Recalculate removed subtotal (defensive: compute from snapshot)
            const removedSubtotal = this.calculateItemSubtotal(removed);

            // Recompute totalAmount from items (preferred) rather than subtract to avoid drift
            cart.totalAmount = cart.items.reduce((s: number, it: any) => {
                return s + (typeof it.subtotal === 'number' ? it.subtotal : this.calculateItemSubtotal(it));
            }, 0);

            // Save
            await cart.save({ session: session ?? undefined });

            if (session) {
                await session.commitTransaction();
            }

            this.logger.log(`User ${userId} removed cart item ${cartItemId}. Removed subtotal ${removedSubtotal}. New total ${cart.totalAmount}`);

            // Return safe summary
            return {
                cartId: cart._id,
                removedItemId: cartItemId,
                totalAmount: cart.totalAmount,
                itemCount: cart.items.length,
            };

        } catch (err) {
            console.log("error in delete cart item service", err)
            this.logger.error('Failed to delete cart item', { err });
            if (session) {
                try { await session.abortTransaction(); } catch (e) { }
            }
            // bubble up specific errors
            if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
            throw new InternalServerErrorException('Failed to remove cart item.');
        } finally {
            if (session) {
                try { await session.endSession(); } catch (e) { }
            }
        }
    }
    async deleteAddonByCartItemId(
        userId: Types.ObjectId,
        cartItemId: Types.ObjectId,
        addonId: Types.ObjectId,
    ) {
        if (
            !Types.ObjectId.isValid(String(userId)) ||
            !Types.ObjectId.isValid(String(cartItemId)) ||
            !Types.ObjectId.isValid(String(addonId))
        ) {
            throw new BadRequestException('Invalid identifiers provided.');
        }

        let session: ClientSession | null = null;
        let transactionStarted = false; // 🔥 Prevent double abort

        try {
            session = await this.startSessionIfSupported();
            if (session) {
                session.startTransaction();
                transactionStarted = true;
            }

            // 1. Load cart
            const cart = await this.cartModel
                .findOne({ userId, status: 'active' })
                .session(session ?? null);

            if (!cart) {
                throw new NotFoundException('No active cart found for user.');
            }

            // 2. Find target cart item
            const item = cart.items.find(
                (it: any) => it._id.toString() === cartItemId.toString(),
            );

            if (!item) {
                throw new NotFoundException('Cart item not found.');
            }

            // 3. Remove the addon
            const beforeCount = item.addons.length;
            console.log("item.addons before filter", item.addons)
            console.log("addonId to be removed", addonId)
            item.addons = item.addons.filter(
                (a) => (a as any)._id.toString() !== addonId.toString(),
            );

            if (item.addons.length === beforeCount) {
                throw new NotFoundException('Addon not found in this cart item.');
            }

            // 4. Save (subtotal recalculated by pre-save hook)
            await cart.save({ session: session ?? undefined });

            if (transactionStarted) {
                await session!.commitTransaction();
                transactionStarted = false; // 🔥 prevent abort in finally
            }

            return {
                message: 'Addon removed successfully.',
                cartId: cart._id,
                cartItemId,
                removedAddonId: addonId,
                itemSubtotal: item.subtotal,
                totalAmount: cart.totalAmount,
            };
        } catch (err) {
            if (session && transactionStarted) {
                try {
                    await session.abortTransaction();
                } catch (e) {
                    // ignore "already aborted" errors safely
                }
            }

            this.logger.error('Failed to delete addon from cart item', err);

            if (err instanceof NotFoundException || err instanceof BadRequestException) {
                throw err;
            }

            throw new InternalServerErrorException('Failed to remove addon.');
        } finally {
            if (session) {
                try {
                    await session.endSession();
                } catch (e) { }
            }
        }
    }



    // helper: compute item subtotal from stored value or base price
    // Note: addon prices are calculated by pre-save hook, so use stored subtotal if available
    private calculateItemSubtotal(item: any): number {
        if (typeof item?.subtotal === 'number') {
            return item.subtotal;
        }
        // Fallback to base tier price only (addon prices looked up by pre-save hook)
        return Number(item?.selectedTier?.price || 0);
    }

    // start a session when driver supports transactions
    private async startSessionIfSupported(): Promise<ClientSession | null> {
        try {
            // Mongoose startSession will work but transactions require replica set
            const s = await (this.cartModel.db as any).startSession();
            // Optionally check if server supports transactions; if not, just return null
            // but we try and use it — if not supported, commit/abort will throw and fallback happens
            return s;
        } catch (err) {
            this.logger.warn('Transactions not available; proceeding without session.');
            return null;
        }
    }



    // cart.service.ts

    async restoreItemToDraft(userId: Types.ObjectId, cartItemId: Types.ObjectId) {

        // 1️⃣ Fetch ONE item only — no full doc hydration
        const cart = await this.cartModel.findOne(
            { userId, "items._id": cartItemId },
            { "items.$": 1 }
        ).lean(); // ← lean() for raw object, faster

        if (!cart || !cart.items?.length) {
            throw new NotFoundException("Cart item not found");
        }

        const item = cart.items[0];

        // 2️⃣ Prepare mapped structure (immutable + explicit)
        const mappedDraft: Partial<DraftCartItemDocument> = {
            userId,
            eventId: item.eventId,
            eventCategory: item.eventCategory,
            eventTitle: item.eventTitle,
            selectedTier: item.selectedTier,
            addons: item.addons,
            eventDate: item.eventDate,
            eventTime: item.eventTime,
            eventBookingDate: item.eventBookingDate ?? new Date(),
            addressId: item.addressId,

        };

        // 3️⃣ Use UPSERT instead of find + save
        const draft = await this.draftCartModel.findOneAndUpdate(
            { userId },               // filter
            { $set: mappedDraft },    // new data
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return {
            success: true,
            restoredItemId: cartItemId,
            draft,
        };
    }



}
