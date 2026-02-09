// order.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, HydratedDocument } from 'mongoose';
import { Order, OrderDocument } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { CheckoutIntent } from '../checkout/checkout-intent.schema';
import { CartItem } from '../carts/cart.schema';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { UserOrdersQueryDto } from './dto/user-orders-query.dto';
import { OrderNumberService } from './services/order-number.service';
import { CartService } from 'src/modules/carts/cart.service';
import { Connection } from 'mongoose';
import { first } from 'rxjs';
import { Tier } from '@aws-sdk/client-s3';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { lookupAndUnwind } from '../../common/utils/mongoose-lookup.util';
import { User } from '../users/users.schema';

import { UserDocument } from '../users/users.schema';
import logger from '../../common/utils/logger';


@Injectable()
export class OrderService {
    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel(CartItem.name) private cartModel: Model<CartItem>,
        @InjectModel(CheckoutIntent.name)
        private readonly checkoutIntentModel: Model<CheckoutIntent>,
        @InjectModel(User.name) private userModel: Model<User>,
        private readonly eventEmitter: EventEmitter2,
        private readonly cartService: CartService,
        private readonly orderNumberService: OrderNumberService,
        @InjectConnection() private readonly connection: Connection,
    ) { }



    async createOrder(dto: CreateOrderDto, userId: Types.ObjectId) {
        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            const { cartId, couponCode, paymentId } = dto;

            // 1. Fetch only selected items
            const cartAgg = await this.cartModel.aggregate([
                { $match: { _id: cartId, userId } },

                {
                    $project: {
                        items: {
                            $filter: {
                                input: "$items",
                                as: "i",
                                cond: { $eq: ["$$i.isCheckOut", 1] }
                            }
                        }
                    }
                }
            ]).session(session);

            if (!cartAgg.length) throw new NotFoundException("Cart not found");

            const selectedItems = cartAgg[0].items || [];

            if (!selectedItems.length) {
                throw new BadRequestException("No valid items selected for order");
            }

            // 2. Subtotal
            const totalSubtotal = selectedItems.reduce(
                (sum, item) => sum + (item?.subtotal || 0),
                0
            );

            // 3. Coupon
            let discount = 0;
            let couponSnapshot = null;

            if (couponCode) {
                const result = await this.applyCoupon(couponCode, totalSubtotal);
                discount = result.discount;
                couponSnapshot = result.snapshot;
            }

            // 4. Prepare orders
            const checkoutBatchId = new Types.ObjectId();
            let remainingDiscount = discount;

            const orderNumbers = await Promise.all(
                selectedItems.map(() =>
                    this.orderNumberService.getNextOrderNumber(session)
                )
            );

            // 4. Build orders
            const ordersToInsert: Order[] = selectedItems.map((item: any, idx: number) => {
                const orderNumber = orderNumbers[idx];

                const baseAmount = item?.selectedTier?.price || 0;

                const addonsAmount = (item?.addons || []).reduce(
                    (sum: number, a: any) => sum + (a?.selectedTier?.price || 0),
                    0
                );

                // Proportional discount
                let proportionalDiscount = 0;
                if (totalSubtotal > 0 && discount > 0) {
                    proportionalDiscount = Math.floor(
                        ((item?.subtotal || 0) / totalSubtotal) * discount
                    );
                }

                if (idx === selectedItems.length - 1) {
                    proportionalDiscount = remainingDiscount;
                }

                remainingDiscount -= proportionalDiscount;

                return {
                    userId,
                    checkoutBatchId,
                    orderNumber,
                    orderStatus: '',
                    event: {
                        eventId: item?.eventId || null,
                        eventTitle: item?.eventTitle || "",
                        eventCategory: item?.eventCategory || "",
                        banner: [],
                    },

                    selectedTier: {
                        tierId: item?.selectedTier?.tierId || null,
                        name: item?.selectedTier?.name || "",
                        price: item?.selectedTier?.price || 0,
                        features: item?.selectedTier?.features || [],
                    },

                    addons: (item?.addons || []).map((a: any) => ({
                        addOnId: a?.addOnId || null,
                        name: a?.name || "",
                        selectedTier: {
                            tierId: a?.selectedTier?.tierId || null,
                            name: a?.selectedTier?.name || "",
                            price: a?.selectedTier?.price || 0
                        },
                        addOnVendorId: a?.assignAddonVendor,
                        banner: [],
                    })),

                    eventDate: item?.eventDate || null,
                    eventTime: item?.eventTime || null,
                    eventBookingDate: item?.eventBookingDate || null,

                    addressId: item?.addressId || null,

                    addressDetails: {
                        name: item?.addressDetails?.name || null,
                        address: item?.addressDetails?.address || null,
                        street: item?.addressDetails?.street || null,
                        isDefault: item?.addressDetails?.isDefault ?? false,
                        landMark: item?.addressDetails?.landMark || null,
                        mobile: item?.addressDetails?.mobile || null,
                        city: item?.addressDetails?.city || null,
                        state: item?.addressDetails?.state || null,
                        pincode: item?.addressDetails?.pincode || null,
                        addressType: item?.addressDetails?.addressType || null,
                        companyName: item?.addressDetails?.companyName || null,
                        gstin: item?.addressDetails?.gstin || null,
                        latitude: item?.addressDetails?.latitude || null,
                        longitude: item?.addressDetails?.longitude || null,
                    },

                    vendorId: item?.assignVendor || null,

                    baseAmount,
                    addonsAmount,
                    subtotal: item?.subtotal || 0,
                    discount: proportionalDiscount,

                    totalAmount: (item?.subtotal || 0) - proportionalDiscount,

                    paymentDetails: {
                        method: dto.paymentMethod,
                    },
                    couponCode,
                    couponSnapshot,
                    paymentId,

                    status: "paid",
                } as Order;
            });

            // 5. Insert
            const createdOrders = await this.orderModel.insertMany(
                ordersToInsert,
                { session }
            );

            // 6. Remove selected items
            await this.cartModel.updateOne(
                { _id: cartId },
                { $pull: { items: { isCheckOut: 1 } } },
                { session }
            );

            await session.commitTransaction();
            this.eventEmitter.emit('order.created', {
                email: 'nk580585@gmail.com',
                name: "Narendra",
                orderId: "ND783H8HD",
                amount: 48758,
            });
            return {
                message: 'Order created successfully',
                batchId: checkoutBatchId

            };

        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    }
    private mapTierSnapshot(tier: any) {
        return {
            tierId: tier.tierId,
            name: tier.name ?? 'Standard', // 🔐 guarantee
            price: tier.price ?? 0,
            features: tier.features ?? [],
        };
    }

    private mapAddonSnapshot(addon: any) {
        return {
            addOnId: addon.addOnId,
            name: addon.name ?? 'Addon',
            selectedTier: {
                tierId: addon.selectedTier?.tierId,
                name: addon.selectedTier?.name ?? 'Addon Tier',
                price: addon.selectedTier?.price ?? 0,
            },
            addOnVendorId: addon.assignAddonVendor ?? undefined,
            banner: addon.banner || [],
        };
    }

    async createOrderFromCheckoutIntent(
        checkoutIntentId: Types.ObjectId,
        paymentId: string,
    ) {

        console.log("order create by createOrderFromCheckoutIntent function")
        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            /* -------------------------------------------------
             * 1️⃣ Fetch intent (LOCKED)
             * ------------------------------------------------- */
            const intent = await this.checkoutIntentModel
                .findById(checkoutIntentId)
                .populate('userId', 'firstName email mobile')
                .session(session); // ✅ Mongoose document

            if (!intent) {
                await session.abortTransaction();
                return;
            }
            // ✅ Tell TS: this is a populated user
            const user = intent.userId as unknown as UserDocument;


            // 🔒 Already processed → idempotent return
            if (intent.status === 'completed') {
                const existing = await this.orderModel.findOne(
                    { checkoutIntentId: intent._id },
                    null,
                    { session },
                );

                await session.abortTransaction();
                return existing;
            }




            /* -------------------------------------------------
             * 2️⃣ Idempotency guard
             * ------------------------------------------------- */
            const existing = await this.orderModel.findOne(
                { checkoutIntentId: intent._id },
                null,
                { session },
            );

            if (existing) {
                await session.abortTransaction();
                return;
            }

            /* -------------------------------------------------
             * 3️⃣ Prepare batch
             * ------------------------------------------------- */
            const checkoutBatchId = new Types.ObjectId();
            const ordersToInsert: Partial<Order>[] = [];

            const orderNumbers = await Promise.all(
                intent.items.map(() =>
                    this.orderNumberService.getNextOrderNumber(session),
                ),
            );

            /* -------------------------------------------------
             * 4️⃣ Build orders
             * ------------------------------------------------- */
            intent.items.forEach((item, idx) => {
                const baseAmount = item.selectedTier?.price || 0;
                const addonsAmount =
                    item.addons?.reduce(
                        (sum, a) => sum + (a.selectedTier?.price || 0),
                        0,
                    ) || 0;

                ordersToInsert.push({
                    userId: intent.userId,
                    checkoutIntentId: intent._id,
                    checkoutBatchId,
                    orderNumber: orderNumbers[idx],

                    event: {
                        eventId: item.eventId,
                        eventTitle: item.eventTitle,
                        eventCategory: item.eventCategory,
                        banner: (item as any).banner || [],
                    },

                    selectedTier: this.mapTierSnapshot(item.selectedTier),

                    addons: (item.addons || []).map((a) =>
                        this.mapAddonSnapshot(a),
                    ),

                    eventDate: item.eventDate,
                    eventTime: item.eventTime,
                    eventBookingDate: item.eventBookingDate,

                    addressDetails: item.addressDetails,

                    vendorId: item.assignVendor ?? undefined,

                    baseAmount,
                    addonsAmount,
                    subtotal: item.subtotal,
                    discount: 0,
                    totalAmount: item.subtotal,

                    paymentDetails: {
                        method: 'online', // ✅ matches schema
                    },

                    paymentId: paymentId.toString(), // ✅ FIX HERE
                    status: 'paid',
                });
            });

            /* -------------------------------------------------
             * 5️⃣ Insert
             * ------------------------------------------------- */
            await this.orderModel.insertMany(ordersToInsert, { session });

            /* -------------------------------------------------
             * 6️⃣ Clear cart (cart checkout only)
             * ------------------------------------------------- */
            if (intent.source === 'cart' && intent.cartId) {
                await this.cartModel.updateOne(
                    { _id: intent.cartId },
                    { $pull: { items: { isCheckOut: 1 } } },
                    { session },
                );
            }

            /* -------------------------------------------------
             * 7️⃣ Close intent
             * ------------------------------------------------- */
            intent.status = 'completed';
            intent.orderId = checkoutBatchId;
            await intent.save({ session });

            /* -------------------------------------------------
             * 8️⃣ Commit
             * ------------------------------------------------- */
            await session.commitTransaction();
            /* -------------------------------------------------
             * 9️⃣ Emit booking.confirmed event (AFTER COMMIT)
             * ------------------------------------------------- */
            const bookingDetails = ordersToInsert.map((order) => ({
                bookingId: order.orderNumber,
                eventName: order.event?.eventTitle,
                eventDateTime: `${order.eventDate} ${order.eventTime}`,
                venue: order.addressDetails?.address ?? 'N/A',
                amount: Number(order.totalAmount) || 0, // 👈 GUARANTEED NUMBER
                paymentStatus: 'PAID',

                // optional (safe)
                packageName: order.selectedTier?.name ?? 'Standard',
                packagePrice: order.selectedTier?.price ?? order.totalAmount,
                packageDescription: order.selectedTier?.description ?? '',
            }));
            const bookingSummary = {
                bookingCount: bookingDetails.length,
                totalAmount: bookingDetails.reduce(
                    (sum, b) => sum + b?.amount,
                    0,
                ),
                paymentStatus: 'PAID',

            };
            this.eventEmitter.emit('booking.confirmed', {
                email: user.email,        // 🔥 MUST NOT BE undefined
                userName: user.firstName,
                mobile: user.mobile,      // for WhatsApp
                // full details (for email / internal use)
                bookingDetails,

                // summary (for WhatsApp)
                bookingSummary,
            });



            return { success: true, checkoutBatchId };
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            session.endSession();
        }
    }





    async applyCoupon(code: string, subtotal: number) {
        return { discount: 0, snapshot: null };
    }


    async generateOrderNumber() {
        const count = await this.orderModel.countDocuments();
        return `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
    }

    async getOrdersForUser(userId: Types.ObjectId, query: UserOrdersQueryDto) {
        const {
            page = 1,
            limit = 25,
            sortBy = "createdAt",
            sortDir = "desc",
            status,
            upcoming,
            search,
            startDate,
            endDate,
        } = query;

        const skip = (page - 1) * limit;
        const sort: Record<string, 1 | -1> = { [sortBy]: sortDir === "asc" ? 1 : -1 };

        // ----------------------------
        // FILTERS
        // ----------------------------
        const filters: any = { userId };

        if (status) filters.status = status;

        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        if (search) {
            const s = search.trim();
            if (Types.ObjectId.isValid(s)) {
                filters.$or = [{ _id: new Types.ObjectId(s) }, { userId: new Types.ObjectId(s) }];
            } else {
                filters.orderNumber = { $regex: s, $options: "i" };
            }
        }

        if (upcoming === true) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            filters.status = { $in: ["paid", "processing", "confirmed"] };
            filters.eventBookingDate = { $gte: today };
        }

        const result = await this.orderModel.aggregate([
            { $match: filters },

            // -----------------------------------------
            // EVENT LOOKUP (birthdayevents + experientialevents + addons)
            // -----------------------------------------
            {
                $lookup: {
                    from: "birthdayevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "birthdayEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                description: 1,
                                city: 1,
                                duration: 1,
                                tiers: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1,
                            },
                        },
                    ],
                },
            },
            {
                $lookup: {
                    from: "experientialevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "experientialEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                description: 1,
                                city: 1,
                                duration: 1,
                                tiers: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1,
                            },
                        },
                    ],
                },
            },
            {
                $lookup: {
                    from: "addons",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "addOnEvent", // ✅ rename (important)
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                description: 1,
                                city: 1,
                                duration: 1,
                                tiers: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1,
                            },
                        },
                    ],
                },
            },

            // ✅ PICK CORRECT EVENT MODEL BASED ON eventCategory
            {
                $addFields: {
                    eventData: {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: ["$event.eventCategory", "BirthdayEvent"] },
                                    then: { $arrayElemAt: ["$birthdayEvent", 0] },
                                },
                                {
                                    case: { $eq: ["$event.eventCategory", "ExperientialEvent"] },
                                    then: { $arrayElemAt: ["$experientialEvent", 0] },
                                },
                                {
                                    case: { $eq: ["$event.eventCategory", "AddOn"] }, // ✅ NEW
                                    then: { $arrayElemAt: ["$addOnEvent", 0] },
                                },
                            ],
                            default: null,
                        },
                    },
                },
            },

            { $project: { birthdayEvent: 0, experientialEvent: 0, addOnEvent: 0 } },

            // -----------------------------------------
            // FILTER SELECTED EVENT TIER ONLY
            // -----------------------------------------
            {
                $addFields: {
                    "eventData.tiers": {
                        $filter: {
                            input: { $ifNull: ["$eventData.tiers", []] },
                            as: "t",
                            cond: { $eq: ["$$t._id", "$selectedTier.tierId"] },
                        },
                    },
                },
            },

            // -----------------------------------------
            // EVENT CATEGORY LOOKUPS
            // -----------------------------------------
            {
                $lookup: {
                    from: "dropdownoptions",
                    let: {
                        ids: {
                            $cond: [
                                { $isArray: "$eventData.experientialEventCategory" },
                                "$eventData.experientialEventCategory",
                                [{ $ifNull: ["$eventData.experientialEventCategory", null] }],
                            ],
                        },
                    },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, value: 1, label: 1, isActive: 1 } },
                    ],
                    as: "eventData.experientialEventCategory",
                },
            },
            {
                $lookup: {
                    from: "subexperientialeventcategories",
                    let: { ids: { $ifNull: ["$eventData.subExperientialEventCategory", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, name: 1 } },
                    ],
                    as: "eventData.subExperientialEventCategory",
                },
            },

            // -----------------------------------------
            // ADDONS LOOKUP (order addons list)
            // -----------------------------------------
            {
                $lookup: {
                    from: "addons",
                    let: { ids: { $ifNull: ["$addons.addOnId", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                tiers: 1,
                                banner: 1,
                                description: 1,
                            },
                        },
                    ],
                    as: "addonsData",
                },
            },

            // MERGE ADDONS
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "a",
                            in: {
                                $mergeObjects: [
                                    "$$a",
                                    {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: "$addonsData",
                                                    as: "ad",
                                                    cond: { $eq: ["$$ad._id", "$$a.addOnId"] },
                                                },
                                            },
                                            0,
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            { $project: { addonsData: 0 } },

            // FILTER SELECTED TIER FOR ADDONS
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "addon",
                            in: {
                                $mergeObjects: [
                                    "$$addon",
                                    {
                                        tiers: {
                                            $filter: {
                                                input: "$$addon.tiers",
                                                as: "tier",
                                                cond: { $eq: ["$$tier._id", "$$addon.selectedTier.tierId"] },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            },

            // -----------------------------------------
            // FINAL PROJECTION
            // -----------------------------------------
            {
                $project: {
                    _id: 1,
                    userId: 1,
                    event: {
                        eventId: "$event.eventId",
                        eventTitle: "$event.eventTitle",
                        eventCategory: "$event.eventCategory",
                        eventDetails: {
                            title: "$eventData.title",
                            banner: "$eventData.banner",
                            description: "$eventData.description",
                            city: "$eventData.city",
                            duration: "$eventData.duration",
                            tiers: "$eventData.tiers",
                            experientialEventCategory: "$eventData.experientialEventCategory",
                            subExperientialEventCategory: "$eventData.subExperientialEventCategory",
                        },
                    },

                    selectedTier: 1,
                    addons: 1,

                    addressDetails: { city: "$addressDetails.city" },
                    eventDate: 1,
                    eventTime: 1,
                    totalAmount: 1,
                    createdAt: 1,
                },
            },

            // PAGINATION
            { $sort: sort },
            { $skip: skip },
            { $limit: limit },

            // META
            {
                $facet: {
                    data: [{ $match: {} }],
                    metadata: [{ $count: "total" }, { $addFields: { page, limit } }],
                },
            },
            {
                $addFields: {
                    metadata: {
                        $ifNull: [{ $arrayElemAt: ["$metadata", 0] }, { total: 0, page, limit }],
                    },
                },
            },
        ]);

        return {
            results: result[0].data,
            totalResults: result[0].metadata.total,
            page: result[0].metadata.page,
            limit: result[0].metadata.limit,
            totalPages: Math.ceil(result[0].metadata.total / limit),
        };
    }


    async getUserOrderById(orderId: Types.ObjectId, userId: Types.ObjectId) {
        console.log("Fetching order by ID:", orderId, "for user:", userId);

        if (!Types.ObjectId.isValid(orderId)) {
            throw new BadRequestException("Invalid order ID format");
        }

        const result = await this.orderModel.aggregate([
            // -------------------------------------------------
            // MATCH ORDER
            // -------------------------------------------------
            {
                $match: { _id: orderId, userId },
            },

            // -------------------------------------------------
            // EVENT LOOKUP — BirthdayEvent
            // -------------------------------------------------
            {
                $lookup: {
                    from: "birthdayevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "birthdayEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                discount: 1,
                                description: 1,
                                duration: 1,
                                tiers: 1,
                                coreActivity: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1,
                            },
                        },
                    ],
                },
            },

            // -------------------------------------------------
            // EVENT LOOKUP — ExperientialEvent
            // -------------------------------------------------
            {
                $lookup: {
                    from: "experientialevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "experientialEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                description: 1,
                                duration: 1,
                                tiers: 1,
                                coreActivity: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1,
                            },
                        },
                    ],
                },
            },

            // -------------------------------------------------
            // ✅ EVENT LOOKUP — AddOn (NEW)
            // -------------------------------------------------
            {
                $lookup: {
                    from: "addons",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "addOnEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                description: 1,
                                duration: 1,
                                tiers: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1,
                            },
                        },
                    ],
                },
            },

            // -------------------------------------------------
            // ✅ SELECT THE CORRECT EVENT MODEL (Birthday / Experiential / AddOn)
            // -------------------------------------------------
            {
                $addFields: {
                    eventData: {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: ["$event.eventCategory", "BirthdayEvent"] },
                                    then: { $arrayElemAt: ["$birthdayEvent", 0] },
                                },
                                {
                                    case: { $eq: ["$event.eventCategory", "ExperientialEvent"] },
                                    then: { $arrayElemAt: ["$experientialEvent", 0] },
                                },
                                {
                                    case: { $eq: ["$event.eventCategory", "AddOn"] },
                                    then: { $arrayElemAt: ["$addOnEvent", 0] },
                                },
                            ],
                            default: null,
                        },
                    },
                },
            },

            { $project: { birthdayEvent: 0, experientialEvent: 0, addOnEvent: 0 } },

            // -------------------------------------------------
            // FILTER SELECTED EVENT TIER
            // -------------------------------------------------
            {
                $addFields: {
                    "eventData.tiers": {
                        $filter: {
                            input: { $ifNull: ["$eventData.tiers", []] },
                            as: "tier",
                            cond: { $eq: ["$$tier._id", "$selectedTier.tierId"] },
                        },
                    },
                },
            },

            // -------------------------------------------------
            // EXPERIENTIAL CATEGORY LOOKUP
            // -------------------------------------------------
            {
                $lookup: {
                    from: "dropdownoptions",
                    let: {
                        ids: {
                            $cond: [
                                { $isArray: "$eventData.experientialEventCategory" },
                                "$eventData.experientialEventCategory",
                                {
                                    $ifNull: [
                                        {
                                            $cond: [
                                                { $gt: ["$eventData.experientialEventCategory", null] },
                                                ["$eventData.experientialEventCategory"],
                                                [],
                                            ],
                                        },
                                        [],
                                    ],
                                },
                            ],
                        },
                    },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, value: 1, label: 1, isActive: 1 } },
                    ],
                    as: "eventData.experientialEventCategory",
                },
            },

            // -------------------------------------------------
            // SUB-EXPERIENTIAL CATEGORY LOOKUP
            // -------------------------------------------------
            {
                $lookup: {
                    from: "subexperientialeventcategories",
                    let: { ids: { $ifNull: ["$eventData.subExperientialEventCategory", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, name: 1, experientialEventCategoryId: 1 } },
                    ],
                    as: "eventData.subExperientialEventCategory",
                },
            },

            // -------------------------------------------------
            // ADDONS LOOKUP + MERGE (ORDER ADDONS LIST)
            // -------------------------------------------------
            {
                $lookup: {
                    from: "addons",
                    let: { ids: { $ifNull: ["$addons.addOnId", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                banner: 1,
                                category: 1,
                                description: 1,
                                tiers: 1,
                                cityOfOperation: 1,
                                isActive: 1,
                            },
                        },
                    ],
                    as: "addonsData",
                },
            },

            // MERGE ADDON DETAILS WITH SELECTED TIER
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "item",
                            in: {
                                $mergeObjects: [
                                    "$$item",
                                    {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: "$addonsData",
                                                    as: "a",
                                                    cond: { $eq: ["$$a._id", "$$item.addOnId"] },
                                                },
                                            },
                                            0,
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                },
            },

            // FILTER ADDON TIERS
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "addon",
                            in: {
                                $mergeObjects: [
                                    "$$addon",
                                    {
                                        tiers: {
                                            $filter: {
                                                input: { $ifNull: ["$$addon.tiers", []] },
                                                as: "t",
                                                cond: { $eq: ["$$t._id", "$$addon.selectedTier.tierId"] },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            },

            { $project: { addonsData: 0 } },
        ]);

        if (!result.length) {
            throw new NotFoundException("Order not found or unauthorized");
        }

        return result[0];
    }

    async getOrderByIdForAdmin(orderId: Types.ObjectId) {
        if (!Types.ObjectId.isValid(orderId)) {
            throw new BadRequestException("Invalid order ID format");
        }

        const pipeline: any[] = [

            // MATCH ORDER
            { $match: { _id: orderId } },

            // USER LOOKUP
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [
                        {
                            $project: {
                                firstName: 1,
                                lastName: 1,
                                email: 1,
                                mobile: 1,

                            }
                        }
                    ]
                }
            },
            { $set: { user: { $first: "$user" } } },


            // MAIN VENDOR DETAILS
            {
                $lookup: {
                    from: "vendors",
                    localField: "vendorId",
                    foreignField: "_id",
                    as: "vendorDetails",
                    pipeline: [
                        {
                            $project: {
                                businessName: 1,
                                email: 1,
                                phone: 1,
                                city: 1,
                                gstNo: 1,
                                address: 1
                            }
                        }
                    ]
                }
            },
            { $set: { vendorDetails: { $first: "$vendorDetails" } } },

            // EVENT LOOKUPS
            {
                $lookup: {
                    from: "birthdayevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "birthdayEvent"
                }
            },
            {
                $lookup: {
                    from: "experientialevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "experientialEvent"
                }
            },

            // select event type
            {
                $set: {
                    eventData: {
                        $cond: [
                            { $eq: ["$event.eventCategory", "BirthdayEvent"] },
                            { $first: "$birthdayEvent" },
                            { $first: "$experientialEvent" }
                        ]
                    }
                }
            },

            // EXPERIENTIAL CATEGORY LOOKUP
            {
                $lookup: {
                    from: "dropdownoptions",
                    let: {
                        ids: {
                            $cond: [
                                { $isArray: "$eventData.experientialEventCategory" },
                                "$eventData.experientialEventCategory",
                                [
                                    {
                                        $ifNull: ["$eventData.experientialEventCategory", null]
                                    }
                                ]
                            ]
                        }
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $in: ["$_id", "$$ids"] }
                            }
                        },
                        { $project: { _id: 1, value: 1, label: 1, isActive: 1 } }
                    ],
                    as: "eventData.experientialEventCategory"
                }
            },

            // SUB EXPERIENTIAL CATEGORY LOOKUP
            {
                $lookup: {
                    from: "subexperientialeventcategories",
                    let: { ids: { $ifNull: ["$eventData.subExperientialEventCategory", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                experientialEventCategoryId: 1
                            }
                        }
                    ],
                    as: "eventData.subExperientialEventCategory"
                }
            },


            {
                $lookup: {
                    from: "vendors",
                    localField: "vendorId",
                    foreignField: "_id",
                    as: "vendorLookup",
                    pipeline: [
                        {
                            $project: {
                                businessName: 1,
                                email: 1,
                                firstName: 1,
                                lastName: 1,
                                mobile: 1,

                                city: 1
                            }
                        }
                    ]
                }
            },

            { $addFields: { vendorDetails: { $arrayElemAt: ["$vendorLookup", 0] } } },
            { $project: { vendorLookup: 0 } },
            // filter event tier
            {
                $set: {
                    "eventData.tiers": {
                        $filter: {
                            input: "$eventData.tiers",
                            cond: { $eq: ["$$this._id", "$selectedTier.tierId"] }
                        }
                    }
                }
            },

            // event discount
            {
                $set: {
                    "eventData.discount": {
                        $cond: [
                            { $eq: ["$event.eventCategory", "BirthdayEvent"] },
                            { $first: "$birthdayEvent.discount" },
                            { $first: "$experientialEvent.discount" }
                        ]
                    }
                }
            },

            // LOOKUP ADDONS
            {
                $lookup: {
                    from: "addons",
                    let: { ids: "$addons.addOnId" },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, name: 1, banner: 1, addOnVendorId: 1 } }
                    ],
                    as: "addonsData"
                }
            },

            // LOOKUP ADDON VENDORS
            {
                $lookup: {
                    from: "vendors",
                    let: { vendorIds: "$addons.addOnVendorId" },
                    pipeline: [
                        {
                            $match: { $expr: { $in: ["$_id", "$$vendorIds"] } }
                        },
                        {
                            $project: {
                                businessName: 1,
                                mobile: 1,
                                email: 1,
                                firstName: 1,
                                lastName: 1,
                                city: 1,
                                gstNo: 1,
                                address: 1
                            }
                        }
                    ],
                    as: "addonVendorLookup"
                }
            },

            // MERGE ADDON DATA
            {
                $set: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "a",
                            in: {
                                $mergeObjects: [

                                    "$$a",

                                    {
                                        $first: {
                                            $filter: {
                                                input: "$addonsData",
                                                cond: { $eq: ["$$this._id", "$$a.addOnId"] }
                                            }
                                        }
                                    },

                                    {
                                        addonVendorData: {
                                            $first: {
                                                $filter: {
                                                    input: "$addonVendorLookup",
                                                    cond: { $eq: ["$$this._id", "$$a.addOnVendorId"] }
                                                }
                                            }
                                        }
                                    },

                                    {
                                        tiers: {
                                            $filter: {
                                                input: {
                                                    $getField: {
                                                        field: "tiers",
                                                        input: {
                                                            $first: {
                                                                $filter: {
                                                                    input: "$addonsData",
                                                                    cond: { $eq: ["$$this._id", "$$a.addOnId"] }
                                                                }
                                                            }
                                                        }
                                                    }
                                                },
                                                cond: { $eq: ["$$this._id", "$$a.selectedTier.tierId"] }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            // ⭐⭐⭐ FINAL EVENT DATA PROJECT (TRIMS EVERYTHING)
            {
                $project: {
                    user: 1,
                    vendorDetails: 1,
                    addons: 1,
                    event: 1,
                    selectedTier: 1,
                    addressDetails: 1,
                    eventDate: 1,
                    eventBookingDate: 1,
                    addressId: 1,
                    eventTime: 1,
                    price: 1,
                    quantity: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    vendorDetail: 1,
                    eventData: {
                        experientialEventCategory: 1,
                        subExperientialEventCategory: 1,
                        tiers: 1,
                        discount: 1,
                        title: 1,
                        ageGroup: 1
                    }
                }
            },

            // CLEANUP
            {
                $project: {
                    addonsData: 0,
                    addonVendorLookup: 0,
                    birthdayEvent: 0,
                    experientialEvent: 0
                }
            }
        ];

        const result = await this.orderModel.aggregate(pipeline);
        if (!result.length) throw new NotFoundException("Order not found");
        return result[0];
    }

    async getOrdersForVendor(vendorId: Types.ObjectId, query: any) {
        const {
            page = 1,
            limit = 25,
            sortBy = "createdAt",
            sortDir = "desc",
            startDate,
            recentBooking,
            endDate,
            search,
            upcoming,
            orderStatus,
            timeSlot,
            eventCategory
        } = query;
        console.log("query in get order list by vendor ", query)
        const skip = (page - 1) * limit;

        /** ----------------------------------------------------
         * BUILD FILTERS
         * ---------------------------------------------------- */
        const filters: any = {
            $or: [
                { vendorId },
                { "addons.addOnVendorId": vendorId }
            ]
        };

        // SEARCH FILTER
        if (search) {
            const s = search.trim();
            filters.$and = [
                {
                    $or: [
                        { orderNumber: { $regex: s, $options: "i" } },
                        { "user.firstName": { $regex: s, $options: "i" } },
                        { "user.lastName": { $regex: s, $options: "i" } },
                        { "user.mobile": { $regex: s, $options: "i" } }
                    ]
                }
            ];
        }

        // DATE RANGE FILTER
        if (startDate || endDate) {
            const dateFilter: any = {};
            if (startDate) dateFilter.$gte = new Date(startDate);
            if (endDate) dateFilter.$lte = new Date(endDate);
            filters.eventBookingDate = dateFilter;
        }

        // UPCOMING FILTER
        if (upcoming === true) {
            console.log('inside the upcoming filter')
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            filters.status = { $in: ["paid", "processing", "confirmed"] };
            filters.eventBookingDate = { $gte: today };
        }


        if (recentBooking === true) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            filters.createdAt = { $gte: sevenDaysAgo };
            filters.orderStatus = { $in: ["pending"] }; // FIXED: status, not orderStatus
        }


        // ORDER STATUS FILTER
        if (orderStatus) {
            const statuses = orderStatus.split(",").map((s: string) => s.trim());
            filters.status = { $in: statuses };
        }



        // EVENT CATEGORY FILTER
        if (eventCategory) {
            filters["event.eventCategory"] = eventCategory;
        }

        console.log("before apply filter", filters)

        /** ----------------------------------------------------
         * AGGREGATION PIPELINE
         * ---------------------------------------------------- */
        return this.orderModel.aggregate([
            /** FILTER ORDERS */
            { $match: filters },

            /** LOOKUP USER */
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [
                        {
                            $project: {
                                firstName: 1,
                                lastName: 1,
                                mobile: 1,
                                role: 1,
                                email: 1
                            }
                        }
                    ]
                }
            },
            { $unwind: "$user" },

            /** PROJECT EVENT + ADDONS */
            {
                $project: {
                    _id: 1,
                    userId: 1,
                    user: 1,
                    checkoutBatchId: 1,
                    orderNumber: 1,
                    eventDate: 1,
                    eventBookingDate: 1,
                    eventTime: 1,
                    timeSlot: 1,
                    addressDetails: 1,
                    paymentDetails: 1,
                    status: 1,
                    orderStatus: 1,
                    createdAt: 1,

                    eventBooking: {
                        $cond: [
                            { $eq: ["$vendorId", vendorId] },
                            {
                                type: "$event.eventCategory",
                                eventId: "$event.eventId",
                                name: "$event.eventTitle",
                                tier: "$selectedTier",
                                amount: "$baseAmount"
                            },
                            null
                        ]
                    },

                    addonBookings: {
                        $map: {
                            input: "$addons",
                            as: "ad",
                            in: {
                                $cond: [
                                    { $eq: ["$$ad.addOnVendorId", vendorId] },
                                    {
                                        type: "addon",
                                        addOnId: "$$ad.addOnId",
                                        name: "$$ad.name",
                                        tier: "$$ad.selectedTier",
                                        amount: "$$ad.selectedTier.price",
                                        eventId: "$event.eventId",
                                        eventTitle: "$event.eventTitle",
                                        eventCategory: "$event.eventCategory"
                                    },
                                    null
                                ]
                            }
                        }
                    }
                }
            },

            /** MERGE EVENT + ADDONS */
            {
                $addFields: {
                    bookings: {
                        $filter: {
                            input: {
                                $concatArrays: [
                                    ["$eventBooking"],
                                    "$addonBookings"
                                ]
                            },
                            as: "b",
                            cond: { $ne: ["$$b", null] }
                        }
                    }
                }
            },

            /** UNWIND MULTIPLE ROWS */
            { $unwind: "$bookings" },

            /** FINAL STRUCTURE */
            {
                $project: {
                    orderId: "$_id",
                    userId: 1,
                    user: 1,
                    checkoutBatchId: 1,
                    orderNumber: 1,
                    eventDate: 1,
                    eventBookingDate: 1,
                    eventTime: 1,
                    timeSlot: 1,
                    addressDetails: 1,
                    paymentDetails: 1,
                    status: 1,
                    orderStatus: 1,
                    createdAt: 1,
                    booking: "$bookings"
                }
            },

            /** SORT + PAGINATION */
            { $sort: { [sortBy]: sortDir === "desc" ? -1 : 1 } },
            { $skip: skip },
            { $limit: limit }
        ]);
    }






    async getOrderByIForUser(orderId: Types.ObjectId) {

        if (!Types.ObjectId.isValid(orderId)) {
            throw new BadRequestException("Invalid order ID format");
        }

        const result = await this.orderModel.aggregate([

            // -------------------------------------------------
            // MATCH ORDER
            // -------------------------------------------------
            { $match: { _id: orderId } },

            // -------------------------------------------------
            // USER LOOKUP
            // -------------------------------------------------
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                firstName: 1,
                                lastName: 1,
                                email: 1,
                                mobile: 1,
                                addresses: 1
                            }
                        }
                    ]
                }
            },

            {
                $addFields: {
                    userBase: { $arrayElemAt: ["$userData", 0] }
                }
            },

            {
                $addFields: {
                    userDetails: {
                        fullName: "$userBase.fullName",
                        firstName: "$userBase.firstName",
                        lastName: "$userBase.lastName",
                        email: "$userBase.email",
                        mobile: "$userBase.mobile",

                        address: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: "$userBase.addresses",
                                        as: "addr",
                                        cond: { $eq: ["$$addr._id", "$addressId"] }
                                    }
                                },
                                0
                            ]
                        }
                    }
                }
            },

            { $project: { userBase: 0, userData: 0 } },

            // -------------------------------------------------
            // ⭐ VENDOR LOOKUP (MERGED)
            // -------------------------------------------------
            {
                $lookup: {
                    from: "vendors",
                    localField: "vendorId",
                    foreignField: "_id",
                    as: "vendorLookup",
                    pipeline: [
                        {
                            $project: {
                                businessName: 1,
                                email: 1,
                                phone: 1,
                                city: 1,
                                gstNo: 1,
                                address: 1
                            }
                        }
                    ]
                }
            },

            {
                $addFields: {
                    vendorDetails: { $arrayElemAt: ["$vendorLookup", 0] }
                }
            },

            { $project: { vendorLookup: 0 } },

            // -------------------------------------------------
            // EVENT LOOKUP — BirthdayEvent
            // -------------------------------------------------
            {
                $lookup: {
                    from: "birthdayevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "birthdayEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                description: 1,
                                duration: 1,
                                tiers: 1,
                                coreActivity: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1
                            }
                        }
                    ]
                }
            },

            // -------------------------------------------------
            // EVENT LOOKUP — ExperientialEvent
            // -------------------------------------------------
            {
                $lookup: {
                    from: "experientialevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "experientialEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                description: 1,
                                duration: 1,
                                tiers: 1,
                                coreActivity: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1
                            }
                        }
                    ]
                }
            },

            // Select correct model
            {
                $addFields: {
                    eventData: {
                        $cond: [
                            { $eq: ["$event.eventCategory", "BirthdayEvent"] },
                            { $arrayElemAt: ["$birthdayEvent", 0] },
                            { $arrayElemAt: ["$experientialEvent", 0] }
                        ]
                    }
                }
            },

            { $project: { birthdayEvent: 0, experientialEvent: 0 } },

            // -------------------------------------------------
            // FILTER SELECTED EVENT TIER
            // -------------------------------------------------
            {
                $addFields: {
                    "eventData.tiers": {
                        $filter: {
                            input: "$eventData.tiers",
                            as: "tier",
                            cond: { $eq: ["$$tier._id", "$selectedTier.tierId"] }
                        }
                    }
                }
            },

            // -------------------------------------------------
            // EXPERIENTIAL CATEGORY LOOKUP (SAFE)
            // -------------------------------------------------
            {
                $lookup: {
                    from: "dropdownoptions",
                    let: {
                        ids: {
                            $cond: [
                                { $isArray: "$eventData.experientialEventCategory" },
                                "$eventData.experientialEventCategory",
                                {
                                    $ifNull: [
                                        {
                                            $cond: [
                                                { $gt: ["$eventData.experientialEventCategory", null] },
                                                ["$eventData.experientialEventCategory"],
                                                []
                                            ]
                                        },
                                        []
                                    ]
                                }
                            ]
                        }
                    },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, value: 1, label: 1, isActive: 1 } }
                    ],
                    as: "eventData.experientialEventCategory"
                }
            },

            // -------------------------------------------------
            // SUB-EXPERIENTIAL CATEGORY LOOKUP
            // -------------------------------------------------
            {
                $lookup: {
                    from: "subexperientialeventcategories",
                    let: { ids: { $ifNull: ["$eventData.subExperientialEventCategory", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, name: 1, experientialEventCategoryId: 1 } }
                    ],
                    as: "eventData.subExperientialEventCategory"
                }
            },

            // -------------------------------------------------
            // ADDONS LOOKUP & MERGE
            // -------------------------------------------------
            {
                $lookup: {
                    from: "addons",
                    let: { ids: { $ifNull: ["$addons.addOnId", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                banner: 1,
                                category: 1,
                                description: 1,
                                tiers: 1,
                                cityOfOperation: 1
                            }
                        }
                    ],
                    as: "addonsData"
                }
            },

            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "item",
                            in: {
                                $mergeObjects: [
                                    "$$item",
                                    {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: "$addonsData",
                                                    as: "a",
                                                    cond: { $eq: ["$$a._id", "$$item.addOnId"] }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            // FILTER SELECTED ADDON TIER
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "addon",
                            in: {
                                $mergeObjects: [
                                    "$$addon",
                                    {
                                        tiers: {
                                            $filter: {
                                                input: "$$addon.tiers",
                                                as: "t",
                                                cond: { $eq: ["$$t._id", "$$addon.selectedTier.tierId"] }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            { $project: { addonsData: 0 } }
        ]);

        if (!result.length) {
            throw new NotFoundException("Order not found");
        }

        return result[0];
    }





    async getOrderByIdForVendor(
        orderId: Types.ObjectId,
        vendorId: Types.ObjectId,
        bookingId: Types.ObjectId,
        type: "event" | "addon" | "AddOn"
    ) {
        if (!Types.ObjectId.isValid(vendorId) || !Types.ObjectId.isValid(orderId)) {
            throw new BadRequestException("Invalid vendorId or orderId");
        }

        const result = await this.orderModel.aggregate([

            // -------------------------------------------------
            // MATCH ORDER FOR THIS VENDOR
            // -------------------------------------------------
            {
                $match: {
                    _id: orderId,
                    $or: [
                        { vendorId },
                        { "addons.addOnVendorId": vendorId }
                    ]
                }
            },

            // -------------------------------------------------
            // USER LOOKUP
            // -------------------------------------------------
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },

            // -------------------------------------------------
            // EXTRACT MAIN EVENT IF OWNED BY VENDOR
            // -------------------------------------------------
            {
                $addFields: {
                    mainEvent: {
                        $cond: [
                            { $eq: ["$vendorId", vendorId] },
                            {
                                eventId: "$event.eventId",
                                eventTitle: "$event.eventTitle",
                                tier: "$selectedTier",
                                baseAmount: "$baseAmount"
                            },
                            null
                        ]
                    }
                }
            },

            // -------------------------------------------------
            // FILTER ONLY THIS VENDOR'S ADDONS
            // -------------------------------------------------
            {
                $addFields: {
                    vendorAddons: {
                        $filter: {
                            input: "$addons",
                            as: "ad",
                            cond: { $eq: ["$$ad.addOnVendorId", vendorId] }
                        }
                    }
                }
            },

            // -------------------------------------------------
            // MAP VENDOR ADDONS
            // -------------------------------------------------
            {
                $addFields: {
                    vendorAddons: {
                        $map: {
                            input: "$vendorAddons",
                            as: "ad",
                            in: {
                                type: "addon",
                                bookingId: "$$ad.addOnId",
                                name: "$$ad.name",
                                tier: "$$ad.selectedTier",
                                amount: "$$ad.selectedTier.price"
                            }
                        }
                    }
                }
            },

            // -------------------------------------------------
            // MERGE MAIN EVENT + ADDONS INTO BOOKINGS ARRAY
            // -------------------------------------------------
            {
                $addFields: {
                    bookings: {
                        $filter: {
                            input: {
                                $concatArrays: [
                                    [
                                        {
                                            $cond: [
                                                { $ne: ["$mainEvent", null] },
                                                {
                                                    type: "event",
                                                    bookingId: "$mainEvent.eventId",
                                                    name: "$mainEvent.eventTitle",
                                                    tier: "$mainEvent.tier",
                                                    amount: "$mainEvent.baseAmount"
                                                },
                                                null
                                            ]
                                        }
                                    ],
                                    "$vendorAddons"
                                ]
                            },
                            as: "b",
                            cond: { $ne: ["$$b", null] }
                        }
                    }
                }
            },

            // -------------------------------------------------
            // PICK THIS (event/addon) BOOKING
            // -------------------------------------------------
            {
                $addFields: {
                    selectedBooking: {
                        $first: {
                            $filter: {
                                input: "$bookings",
                                as: "b",
                                cond: {
                                    $and: [
                                        { $eq: ["$$b.type", type] },
                                        { $eq: ["$$b.bookingId", bookingId] }
                                    ]
                                }
                            }
                        }
                    }
                }
            },

            // -------------------------------------------------
            // LOOKUP EVENT DETAILS (IF EVENT)
            // -------------------------------------------------
            {
                $lookup: {
                    from: "experientialevents",
                    let: { id: "$selectedBooking.bookingId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$id"] } } },

                        // PROJECT BASIC EVENT FIELDS
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                images: 1,
                                description: 1,
                                ageGroup: 1,
                                duration: 1,
                                exclusion: 1,
                                coreActivity: 1,
                                discount: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1
                            }
                        }
                    ],
                    as: "eventDetails"
                }
            },

            // -------------------------------------------------
            // LOOKUP ADDON DETAILS (IF ADDON)
            // -------------------------------------------------
            {
                $lookup: {
                    from: "addons",
                    let: { id: "$selectedBooking.bookingId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$id"] } } },
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                images: 1,
                                description: 1,
                                category: 1
                            }
                        }
                    ],
                    as: "addonDetails"
                }
            },

            // -------------------------------------------------
            // SAFELY ATTACH EVENT DETAILS
            // -------------------------------------------------
            {
                $addFields: {
                    eventData: { $arrayElemAt: ["$eventDetails", 0] }
                }
            },

            // -------------------------------------------------
            // LOOKUP: EXPERIENTIAL EVENT CATEGORY
            // -------------------------------------------------
            {
                $lookup: {
                    from: "dropdownoptions",
                    let: {
                        ids: {
                            $cond: [
                                { $isArray: "$eventData.experientialEventCategory" },
                                "$eventData.experientialEventCategory",
                                {
                                    $ifNull: [
                                        {
                                            $cond: [
                                                { $gt: ["$eventData.experientialEventCategory", null] },
                                                ["$eventData.experientialEventCategory"],
                                                []
                                            ]
                                        },
                                        []
                                    ]
                                }
                            ]
                        }
                    },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, value: 1, label: 1, isActive: 1 } }
                    ],
                    as: "eventCategoryData"
                }
            },

            // -------------------------------------------------
            // LOOKUP: SUB EXPERIENTIAL CATEGORY
            // -------------------------------------------------
            {
                $lookup: {
                    from: "subexperientialeventcategories",
                    let: { ids: { $ifNull: ["$eventData.subExperientialEventCategory", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                experientialEventCategoryId: 1
                            }
                        }
                    ],
                    as: "subEventCategoryData"
                }
            },

            // -------------------------------------------------
            // MERGE DETAILS INTO bookingDetails
            // -------------------------------------------------
            {
                $addFields: {
                    bookingDetails: {
                        $cond: [
                            { $eq: ["$selectedBooking.type", "event"] },
                            {
                                $mergeObjects: [
                                    "$eventData",
                                    {
                                        experientialEventCategory: "$eventCategoryData",
                                        subExperientialEventCategory: "$subEventCategoryData"
                                    }
                                ]
                            },
                            { $arrayElemAt: ["$addonDetails", 0] }
                        ]
                    }
                }
            },

            // -------------------------------------------------
            // FINAL PROJECTION
            // -------------------------------------------------
            {
                $project: {
                    _id: 1,
                    orderNumber: 1,
                    checkoutBatchId: 1,
                    status: 1,
                    orderStatus: 1,
                    eventDate: 1,
                    eventBookingDate: 1,
                    eventTime: 1,
                    timeSlot: 1,
                    paymentDetails: 1,
                    addressDetails: 1,
                    createdAt: 1,

                    user: {
                        firstName: "$user.firstName",
                        lastName: "$user.lastName",
                        mobile: "$user.mobile"
                    },

                    booking: {
                        type: "$selectedBooking.type",
                        bookingId: "$selectedBooking.bookingId",
                        name: "$selectedBooking.name",
                        tier: "$selectedBooking.tier",
                        amount: "$selectedBooking.amount",
                        details: "$bookingDetails"
                    }
                }
            }
        ]);

        if (!result.length || !result[0].booking) {
            throw new NotFoundException("Booking not found for this vendor");
        }

        return result[0];
    }


    // order.service.ts
    // order.service.ts
    async getNextUpcomingEventForVendor(vendorId: Types.ObjectId) {
        const now = new Date();

        return this.orderModel.aggregate([
            /* ----------------------------------------------------
             * 1️⃣ MATCH
             * ---------------------------------------------------- */
            {
                $match: {
                    $or: [{ vendorId }, { "addons.addOnVendorId": vendorId }],
                    eventBookingDate: { $gt: now },
                    status: { $in: ["paid", "processing", "confirmed"] },
                },
            },

            /* ----------------------------------------------------
             * 2️⃣ NORMALIZE DATE
             * ---------------------------------------------------- */
            {
                $addFields: {
                    bookingDay: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$eventBookingDate",
                        },
                    },
                },
            },

            /* ----------------------------------------------------
             * 3️⃣ SORT
             * ---------------------------------------------------- */
            { $sort: { eventBookingDate: 1 } },

            /* ----------------------------------------------------
             * 4️⃣ PICK NEAREST DAY
             * ---------------------------------------------------- */
            {
                $group: {
                    _id: "$bookingDay",
                    orders: { $push: "$$ROOT" },
                    nearestTime: { $first: "$eventBookingDate" },
                },
            },
            { $sort: { nearestTime: 1 } },
            { $limit: 1 },

            /* ----------------------------------------------------
             * 5️⃣ FLATTEN
             * ---------------------------------------------------- */
            { $unwind: "$orders" },
            { $replaceRoot: { newRoot: "$orders" } },

            /* ----------------------------------------------------
             * 6️⃣ USER LOOKUP
             * ---------------------------------------------------- */
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [
                        { $project: { firstName: 1, lastName: 1, mobile: 1 } },
                    ],
                },
            },
            { $unwind: "$user" },

            /* ----------------------------------------------------
             * 7️⃣ EXPERIENTIAL EVENT LOOKUP
             * ---------------------------------------------------- */
            ...lookupAndUnwind(
                "event.eventId",
                "experientialevents",
                "_id",
                {
                    title: 1,
                    banner: 1,
                    experientialEventCategory: 1,
                }
            ),

            /* ----------------------------------------------------
             * 8️⃣ ADDON LOOKUP
             * ---------------------------------------------------- */
            {
                $lookup: {
                    from: "addons",
                    localField: "addons.addOnId",
                    foreignField: "_id",
                    as: "addonDetails",
                    pipeline: [
                        { $project: { name: 1, banner: 1 } },
                    ],
                },
            },

            /* ----------------------------------------------------
             * 9️⃣ BUILD RESPONSE
             * ---------------------------------------------------- */
            {
                $project: {
                    _id: 0,

                    /* -------- EVENT BOOKING */
                    eventBooking: {
                        $cond: [
                            { $eq: ["$vendorId", vendorId] },
                            {
                                type: "$event.eventCategory",
                                eventId: "$event.eventId",
                                title: "$experientialevents.title",
                                tier: "$selectedTier",
                                amount: "$baseAmount",
                                banner: "$experientialevents.banner",
                            },
                            null,
                        ],
                    },

                    /* -------- ADDON BOOKINGS */
                    addonBookings: {
                        $filter: {
                            input: {
                                $map: {
                                    input: "$addons",
                                    as: "ad",
                                    in: {
                                        $cond: [
                                            { $eq: ["$$ad.addOnVendorId", vendorId] },
                                            {
                                                type: "addon",
                                                addOnId: "$$ad.addOnId",
                                                title: "$$ad.name",
                                                tier: "$$ad.selectedTier",
                                                amount: "$$ad.selectedTier.price",
                                                banner: {
                                                    $arrayElemAt: ["$addonDetails.banner", 0],
                                                },
                                            },
                                            null,
                                        ],
                                    },
                                },
                            },
                            as: "a",
                            cond: { $ne: ["$$a", null] },
                        },
                    },

                    /* -------- COMMON UI */
                    dateTime: {
                        date: {
                            $dateToString: {
                                format: "%d %b, %Y",
                                date: "$eventBookingDate",
                            },
                        },
                        time: "$eventTime",
                        eventBookingDate: "$eventBookingDate",
                    },

                    venue: {
                        name: "$addressDetails.address",
                        city: "$addressDetails.city",
                        state: "$addressDetails.state",
                    },

                    revenue: { totalAmount: "$totalAmount" },

                    primaryContact: {
                        name: {
                            $concat: ["$user.firstName", " ", "$user.lastName"],
                        },
                        mobile: "$user.mobile",
                    },

                    status: {
                        paymentStatus: "$status",
                        orderStatus: "$orderStatus",
                    },
                },
            },

            /* ----------------------------------------------------
             * 🔟 MERGE EVENT + ADDONS
             * ---------------------------------------------------- */
            {
                $addFields: {
                    bookings: {
                        $filter: {
                            input: {
                                $concatArrays: [
                                    {
                                        $cond: [
                                            { $ne: ["$eventBooking", null] },
                                            ["$eventBooking"],
                                            [],
                                        ],
                                    },
                                    "$addonBookings",
                                ],
                            },
                            as: "b",
                            cond: { $ne: ["$$b", null] },
                        },
                    },
                },
            },

            /* ----------------------------------------------------
             * 1️⃣1️⃣ FINAL RESPONSE
             * ---------------------------------------------------- */
            {
                $project: {
                    bookings: 1,
                    dateTime: 1,
                    venue: 1,
                    revenue: 1,
                    primaryContact: 1,
                    status: 1,
                },
            },
        ]);
    }





    // async getOrderByIdForVendor(orderId: Types.ObjectId, vendorId: Types.ObjectId, bookingId: Types.ObjectId, type: string) {
    //     if (!Types.ObjectId.isValid(vendorId) || !Types.ObjectId.isValid(orderId)) {
    //         throw new BadRequestException("Invalid IDs");
    //     }
    //     const result = await this.orderModel.aggregate([
    //         // MATCH ONLY THIS ORDER IF VENDOR IS INVOLVED
    //         {
    //             $match: {
    //                 _id: orderId,
    //                 $or: [
    //                     { vendorId },
    //                     { "addons.addOnVendorId": vendorId }
    //                 ]
    //             }
    //         },

    //         // Lookup user details
    //         {
    //             $lookup: {
    //                 from: "users",
    //                 localField: "userId",
    //                 foreignField: "_id",
    //                 as: "user"
    //             }
    //         },
    //         { $unwind: "$user" },

    //         // Lookup main event details only if vendor owns main event
    //         {
    //             $addFields: {
    //                 mainEvent: {
    //                     $cond: [
    //                         { $eq: ["$vendorId", vendorId] },
    //                         {
    //                             eventId: "$event.eventId",
    //                             eventTitle: "$event.eventTitle",
    //                             tier: "$selectedTier",
    //                             amount: "$baseAmount"
    //                         },
    //                         null
    //                     ]
    //                 }
    //             }
    //         },

    //         // Filter addons for this vendor
    //         {
    //             $addFields: {
    //                 vendorAddons: {
    //                     $filter: {
    //                         input: "$addons",
    //                         as: "ad",
    //                         cond: { $eq: ["$$ad.addOnVendorId", vendorId] }
    //                     }
    //                 }
    //             }
    //         },

    //         // FORMAT ADDONS
    //         {
    //             $addFields: {
    //                 vendorAddons: {
    //                     $map: {
    //                         input: "$vendorAddons",
    //                         as: "ad",
    //                         in: {
    //                             eventAddOnId: "$$ad.addOnId",
    //                             type: "addon",
    //                             name: "$$ad.name",
    //                             tier: "$$ad.selectedTier",
    //                             amount: "$$ad.selectedTier.price"
    //                         }
    //                     }
    //                 }
    //             }
    //         },

    //         // Combine event + addons into single booking list (remove null)
    //         {
    //             $addFields: {
    //                 bookings: {
    //                     $filter: {
    //                         input: {
    //                             $concatArrays: [
    //                                 [
    //                                     {
    //                                         $cond: [
    //                                             { $ne: ["$mainEvent", null] },
    //                                             {
    //                                                 type: "event",
    //                                                 eventId: "$mainEvent.eventId",
    //                                                 name: "$mainEvent.eventTitle",
    //                                                 tier: "$mainEvent.tier",
    //                                                 amount: "$mainEvent.amount"
    //                                             },
    //                                             null
    //                                         ]
    //                                     }
    //                                 ],
    //                                 "$vendorAddons"
    //                             ]
    //                         },
    //                         as: "b",
    //                         cond: { $ne: ["$$b", null] }
    //                     }
    //                 }
    //             }
    //         },

    //         // Final Projection
    //         {
    //             $project: {
    //                 _id: 1,
    //                 orderNumber: 1,
    //                 checkoutBatchId: 1,
    //                 user: {
    //                     firstName: 1,
    //                     lastName: 1,
    //                     mobile: 1,
    //                     role: 1
    //                 },
    //                 eventDate: 1,
    //                 eventBookingDate: 1,
    //                 eventTime: 1,
    //                 timeSlot: 1,
    //                 addressDetails: 1,
    //                 paymentDetails: 1,
    //                 status: 1,
    //                 createdAt: 1,
    //                 bookings: 1 // vendor filtered results
    //             }
    //         }
    //     ]);

    //     if (!result || result.length === 0) {
    //         throw new NotFoundException("Order not found");
    //     }

    //     return result[0];
    // }




    // async getUserOrdersByBatchId(batchId: Types.ObjectId, userId: Types.ObjectId) {


    //     // Find order only if it belongs to the user
    //     const order = await this.orderModel
    //         .findOne({ checkoutBatchId: batchId, userId })
    //         .populate({
    //             path: 'event.eventId',
    //             populate: [
    //                 { path: 'experientialEventCategory', strictPopulate: false },
    //                 { path: 'subExperientialEventCategory', strictPopulate: false },
    //                 // Nested populate: Populate the 'author' field of each Comment
    //                 // Optionally select specific fields from User
    //             ],
    //             strictPopulate: false,
    //         }).populate('addons.addOnId')
    //         .lean();

    //     if (!order) {
    //         throw new NotFoundException('Order not found or unauthorized');
    //     }

    //     return order;
    // }
    async getUserOrdersByBatchId(batchId: Types.ObjectId, userId: Types.ObjectId) {
        const result = await this.orderModel.aggregate([
            // ---------------------------------
            // MATCH ORDER
            // ---------------------------------
            {
                $match: {
                    checkoutBatchId: batchId,
                    userId
                }
            },

            // ---------------------------------
            // EVENT LOOKUPS (Both Collections)
            // ---------------------------------
            {
                $lookup: {
                    from: "birthdayevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                description: 1,
                                duration: 1,
                                tiers: 1,
                                coreActivity: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1
                            }
                        }
                    ],
                    as: "birthdayEvent"
                }
            },
            {
                $lookup: {
                    from: "experientialevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                description: 1,
                                duration: 1,
                                tiers: 1,
                                coreActivity: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1
                            }
                        }
                    ],
                    as: "experientialEvent"
                }
            },

            // ---------------------------------
            // CHOOSE CORRECT EVENT DATA
            // ---------------------------------
            {
                $addFields: {
                    eventData: {
                        $cond: [
                            { $eq: ["$event.eventCategory", "BirthdayEvent"] },
                            { $arrayElemAt: ["$birthdayEvent", 0] },
                            { $arrayElemAt: ["$experientialEvent", 0] }
                        ]
                    }
                }
            },

            { $project: { birthdayEvent: 0, experientialEvent: 0 } },

            // ---------------------------------
            // ⭐ FILTER SELECTED EVENT TIER ONLY
            // ---------------------------------
            {
                $addFields: {
                    "eventData.tiers": {
                        $filter: {
                            input: "$eventData.tiers",
                            as: "tier",
                            cond: { $eq: ["$$tier._id", "$selectedTier.tierId"] }
                        }
                    }
                }
            },

            // ---------------------------------
            // EXPERIENTIAL CATEGORY LOOKUP
            // ---------------------------------
            {
                $lookup: {
                    from: "dropdownoptions",
                    let: {
                        ids: {
                            $cond: [
                                { $isArray: "$eventData.experientialEventCategory" },
                                "$eventData.experientialEventCategory",
                                [
                                    {
                                        $ifNull: ["$eventData.experientialEventCategory", null]
                                    }
                                ]
                            ]
                        }
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $in: ["$_id", "$$ids"]
                                }
                            }
                        },
                        { $project: { _id: 1, value: 1, label: 1, isActive: 1 } }
                    ],
                    as: "eventData.experientialEventCategory"
                }
            },



            // ---------------------------------
            // SUB EXPERIENTIAL CATEGORY LOOKUP
            // ---------------------------------
            {
                $lookup: {
                    from: "subexperientialeventcategories",
                    let: { ids: { $ifNull: ["$eventData.subExperientialEventCategory", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                experientialEventCategoryId: 1
                            }
                        }
                    ],
                    as: "eventData.subExperientialEventCategory"
                }
            },


            // ---------------------------------
            // ADDONS LOOKUP WITH PROJECTION
            // ---------------------------------
            {
                $lookup: {
                    from: "addons",
                    let: { ids: "$addons.addOnId" },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                banner: 1,
                                category: 1,
                                description: 1,
                                tiers: 1,
                                cityOfOperation: 1,
                                isActive: 1
                            }
                        }
                    ],
                    as: "addonsData"
                }
            },

            // ---------------------------------
            // MERGE PROJECTED ADDON FIELDS
            // ---------------------------------
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "item",
                            in: {
                                $mergeObjects: [
                                    "$$item",
                                    {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: "$addonsData",
                                                    as: "a",
                                                    cond: { $eq: ["$$a._id", "$$item.addOnId"] }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            { $project: { addonsData: 0 } },

            // ---------------------------------
            // ⭐ FILTER SELECTED TIER INSIDE EACH ADDON
            // ---------------------------------
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "addon",
                            in: {
                                $mergeObjects: [
                                    "$$addon",
                                    {
                                        tiers: {
                                            $filter: {
                                                input: "$$addon.tiers",
                                                as: "tier",
                                                cond: {
                                                    $eq: ["$$tier._id", "$$addon.selectedTier.tierId"]
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        ]);

        if (!result.length) {
            throw new NotFoundException("Order not found or unauthorized");
        }

        return result;
    }




    async getOrdersForAdmin(query: AdminOrdersQueryDto) {

        const {
            page = 1,
            limit = 25,
            sortBy = "createdAt",
            sortDir = "desc",
            status,
            userId,
            search,
            startDate,
            endDate,
        } = query;

        const skip = (page - 1) * limit;

        const sort: Record<string, 1 | -1> = {
            [sortBy]: sortDir === "asc" ? 1 : -1,
        };

        // ---------------------------
        // BUILD FILTERS
        // ---------------------------
        const filters: any = {};

        if (status) filters.status = status;

        if (userId) {
            if (!Types.ObjectId.isValid(userId))
                throw new BadRequestException("Invalid userId");

            filters.userId = new Types.ObjectId(userId);
        }

        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        if (search) {
            const s = search.trim();

            if (Types.ObjectId.isValid(s)) {
                filters.$or = [
                    { _id: new Types.ObjectId(s) },
                    { userId: new Types.ObjectId(s) },
                ];
            } else {
                filters.orderNumber = { $regex: s, $options: "i" };
            }
        }

        // =====================
        // MAIN AGGREGATION
        // =====================
        const result = await this.orderModel.aggregate([

            { $match: filters },

            // ------------------------
            // USER LOOKUP
            // ------------------------
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                firstName: 1,
                                lastName: 1,
                                email: 1,
                                mobile: 1,
                                addresses: 1,
                            }
                        }
                    ]
                }
            },

            {
                $addFields: {
                    userBase: { $arrayElemAt: ["$userData", 0] }
                }
            },

            {
                $addFields: {
                    userDetails: {
                        fullName: "$userBase.fullName",
                        firstName: "$userBase.firstName",
                        lastName: "$userBase.lastName",
                        email: "$userBase.email",
                        mobile: "$userBase.mobile",

                        // only selected Address
                        address: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: "$userBase.addresses",
                                        as: "addr",
                                        cond: { $eq: ["$$addr._id", "$addressId"] }
                                    }
                                },
                                0
                            ]
                        }
                    }
                }
            },

            { $project: { userBase: 0, userData: 0 } },

            // ------------------------
            // VENDOR LOOKUP
            // ------------------------
            {
                $lookup: {
                    from: "vendors",
                    localField: "vendorId",
                    foreignField: "_id",
                    as: "vendorData",
                    pipeline: [
                        {
                            $project: {
                                businessName: 1,
                                email: 1,
                                mobile: 1,
                                city: 1,
                                address: 1,
                                gstNo: 1,
                            }
                        }
                    ]
                }
            },

            {
                $addFields: {
                    vendorDetails: { $arrayElemAt: ["$vendorData", 0] }
                }
            },

            { $project: { vendorData: 0 } },

            // ------------------------
            // EVENT LOOKUPS
            // ------------------------
            {
                $lookup: {
                    from: "birthdayevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "birthdayEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                description: 1,
                                duration: 1,
                                tiers: 1,
                                coreActivity: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1,
                            }
                        }
                    ]
                }
            },

            {
                $lookup: {
                    from: "experientialevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "experientialEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                description: 1,
                                duration: 1,
                                tiers: 1,
                                coreActivity: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1,
                            }
                        }
                    ]
                }
            },

            {
                $addFields: {
                    eventData: {
                        $cond: [
                            { $eq: ["$event.eventCategory", "BirthdayEvent"] },
                            { $arrayElemAt: ["$birthdayEvent", 0] },
                            { $arrayElemAt: ["$experientialEvent", 0] },
                        ]
                    }
                }
            },

            { $project: { birthdayEvent: 0, experientialEvent: 0 } },

            // only selected tier
            {
                $addFields: {
                    "eventData.tiers": {
                        $filter: {
                            input: "$eventData.tiers",
                            as: "t",
                            cond: { $eq: ["$$t._id", "$selectedTier.tierId"] }
                        }
                    }
                }
            },

            // categories
            {
                $lookup: {
                    from: "dropdownoptions",
                    let: {
                        ids: {
                            $cond: [
                                { $isArray: "$eventData.experientialEventCategory" },
                                "$eventData.experientialEventCategory",
                                {
                                    $ifNull: [
                                        {
                                            $cond: [
                                                { $gt: ["$eventData.experientialEventCategory", null] },
                                                ["$eventData.experientialEventCategory"],
                                                []
                                            ]
                                        },
                                        []
                                    ]
                                }
                            ]
                        }
                    },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, value: 1, label: 1 } }
                    ],
                    as: "eventData.experientialEventCategory"
                }
            },

            {
                $lookup: {
                    from: "subexperientialeventcategories",
                    let: { ids: { $ifNull: ["$eventData.subExperientialEventCategory", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { _id: 1, name: 1, experientialEventCategoryId: 1 } }
                    ],
                    as: "eventData.subExperientialEventCategory"
                }
            },

            // ------------------------
            // ADDONS LOOKUP
            // ------------------------
            {
                $lookup: {
                    from: "addons",
                    let: { ids: { $ifNull: ["$addons.addOnId", []] } },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                banner: 1,
                                category: 1,
                                description: 1,
                                tiers: 1,
                                cityOfOperation: 1
                            }
                        }
                    ],
                    as: "addonsData"
                }
            },

            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "item",
                            in: {
                                $mergeObjects: [
                                    "$$item",
                                    {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: "$addonsData",
                                                    as: "a",
                                                    cond: { $eq: ["$$a._id", "$$item.addOnId"] }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            // only selected addon tier
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "addon",
                            in: {
                                $mergeObjects: [
                                    "$$addon",
                                    {
                                        tiers: {
                                            $filter: {
                                                input: "$$addon.tiers",
                                                as: "t",
                                                cond: { $eq: ["$$t._id", "$$addon.selectedTier.tierId"] }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            { $project: { addonsData: 0 } },

            // ------------------------
            // FACET PAGINATION
            // ------------------------
            {
                $facet: {
                    metadata: [
                        { $count: "total" },
                        { $addFields: { page, limit } }
                    ],
                    data: [
                        { $sort: sort as any },
                        { $skip: skip },
                        { $limit: limit },
                        { $project: { paymentDetails: 0, __v: 0 } }
                    ]
                }
            },

            {
                $addFields: {
                    metadata: {
                        $ifNull: [
                            { $arrayElemAt: ["$metadata", 0] },
                            { total: 0, page, limit }
                        ]
                    }
                }
            }
        ]);

        return {
            data: result[0].data,
            totalResults: result[0].metadata.total,
            page: result[0].metadata.page,
            limit: result[0].metadata.limit,
            totalPages: Math.ceil(result[0].metadata.total / limit)
        };
    }



    async getOrdersEventForVendor(vendorId: Types.ObjectId, query: any) {
        const {
            page = 1,
            limit = 25,
            sortBy = "createdAt",
            sortDir = "desc",
            status,
            upcoming,
            search,
            startDate,
            endDate,
        } = query;

        if (!Types.ObjectId.isValid(vendorId)) {
            throw new BadRequestException("Invalid vendorId");
        }

        const skip = (page - 1) * limit;
        const sort: Record<string, 1 | -1> = {
            [sortBy]: sortDir === "asc" ? 1 : -1
        };

        // ------------------------------------
        // FILTERS
        // ------------------------------------
        const filters: any = {
            vendorId: new Types.ObjectId(vendorId)
        };

        if (status) filters.status = status;

        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        if (search) {
            const s = search.trim();
            if (Types.ObjectId.isValid(s)) {
                filters.$or = [
                    { _id: new Types.ObjectId(s) },
                    { orderNumber: { $regex: s, $options: "i" } }
                ];
            } else {
                filters.orderNumber = { $regex: s, $options: "i" };
            }
        }

        if (upcoming === true) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of current day

            filters.status = { $in: ["paid", "processing", "confirmed"] };
            filters.eventBookingDate = { $gte: today };
        }

        // ------------------------------------
        // AGGREGATION START
        // ------------------------------------
        const result = await this.orderModel.aggregate([

            { $match: filters },

            // ------------------------------------
            // USER LOOKUP → ONLY SELECTED ADDRESS
            // ------------------------------------
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                firstName: 1,
                                lastName: 1,
                                email: 1,
                                mobile: 1,
                                addresses: 1
                            }
                        }
                    ]
                }
            },

            { $addFields: { userBase: { $arrayElemAt: ["$userData", 0] } } },

            {
                $addFields: {
                    userDetails: {
                        fullName: "$userBase.fullName",
                        firstName: "$userBase.firstName",
                        lastName: "$userBase.lastName",
                        email: "$userBase.email",
                        mobile: "$userBase.mobile",

                        // ONLY MATCHED ADDRESS
                        address: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: "$userBase.addresses",
                                        as: "addr",
                                        cond: { $eq: ["$$addr._id", "$addressId"] }
                                    }
                                },
                                0
                            ]
                        }
                    }
                }
            },

            { $project: { userBase: 0, userData: 0 } },

            // ------------------------------------
            // EVENT LOOKUP (BIRTHDAY + EXPERIENTIAL)
            // ------------------------------------
            {
                $lookup: {
                    from: "birthdayevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "birthdayEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                duration: 1,
                                description: 1,
                                tiers: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1
                            }
                        }
                    ]
                }
            },

            {
                $lookup: {
                    from: "experientialevents",
                    localField: "event.eventId",
                    foreignField: "_id",
                    as: "experientialEvent",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                banner: 1,
                                city: 1,
                                duration: 1,
                                description: 1,
                                tiers: 1,
                                experientialEventCategory: 1,
                                subExperientialEventCategory: 1
                            }
                        }
                    ]
                }
            },

            // Pick correct model
            {
                $addFields: {
                    eventData: {
                        $cond: [
                            { $eq: ["$event.eventCategory", "BirthdayEvent"] },
                            { $arrayElemAt: ["$birthdayEvent", 0] },
                            { $arrayElemAt: ["$experientialEvent", 0] }
                        ]
                    }
                }
            },

            { $project: { birthdayEvent: 0, experientialEvent: 0 } },

            // ------------------------------------
            // FILTER ONLY SELECTED EVENT TIER
            // ------------------------------------
            {
                $addFields: {
                    "eventData.tiers": {
                        $filter: {
                            input: "$eventData.tiers",
                            as: "t",
                            cond: { $eq: ["$$t._id", "$selectedTier.tierId"] }
                        }
                    }
                }
            },

            // ------------------------------------
            // CATEGORY LOOKUPS
            // ------------------------------------
            {
                $lookup: {
                    from: "dropdownoptions",
                    let: {
                        ids: {
                            $cond: [
                                { $isArray: "$eventData.experientialEventCategory" },
                                "$eventData.experientialEventCategory",
                                [
                                    {
                                        $ifNull: ["$eventData.experientialEventCategory", null]
                                    }
                                ]
                            ]
                        }
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $in: ["$_id", "$$ids"]
                                }
                            }
                        },
                        { $project: { _id: 1, value: 1, label: 1, isActive: 1 } }
                    ],
                    as: "eventData.experientialEventCategory"
                }
            },

            {
                $lookup: {
                    from: "subexperientialeventcategories",
                    let: { ids: "$eventData.subExperientialEventCategory" },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
                        { $project: { name: 1 } }
                    ],
                    as: "eventData.subExperientialEventCategory"
                }
            },

            // ------------------------------------
            // VENDOR LOOKUP
            // ------------------------------------
            {
                $lookup: {
                    from: "vendors",
                    localField: "vendorId",
                    foreignField: "_id",
                    as: "vendorLookup",
                    pipeline: [
                        {
                            $project: {
                                businessName: 1,
                                email: 1,
                                phone: 1,
                                city: 1
                            }
                        }
                    ]
                }
            },

            { $addFields: { vendorDetails: { $arrayElemAt: ["$vendorLookup", 0] } } },
            { $project: { vendorLookup: 0 } },

            // ------------------------------------
            // FINAL PROJECT → FULL EVENT DETAILS
            // ------------------------------------
            {
                $project: {
                    _id: 1,
                    orderNumber: 1,
                    vendorId: 1,
                    userId: 1,

                    event: {
                        eventId: "$event.eventId",
                        eventTitle: "$event.eventTitle",
                        eventCategory: "$event.eventCategory",

                        eventDetails: "$eventData"
                    },

                    selectedTier: 1,
                    addons: 1,

                    eventDate: 1,
                    eventTime: 1,
                    timeSlot: 1,
                    totalAmount: 1,
                    status: 1,
                    orderStatus: 1,
                    createdAt: 1,

                    userDetails: 1,
                    vendorDetails: 1
                }
            },

            // ------------------------------------
            // PAGINATION
            // ------------------------------------
            { $sort: sort },
            { $skip: skip },
            { $limit: limit },

            {
                $facet: {
                    data: [{ $match: {} }],
                    metadata: [
                        { $count: "total" },
                        { $addFields: { page, limit } }
                    ]
                }
            },

            {
                $addFields: {
                    metadata: {
                        $ifNull: [
                            { $arrayElemAt: ["$metadata", 0] },
                            { total: 0, page, limit }
                        ]
                    }
                }
            }
        ]);

        return {
            results: result[0].data,
            totalResults: result[0].metadata.total,
            page: result[0].metadata.page,
            limit: result[0].metadata.limit,
            totalPages: Math.ceil(result[0].metadata.total / limit)
        };
    }




    async getOrdersAddOnForVendor(vendorId: Types.ObjectId, query: any) {
        const {
            page = 1,
            limit = 25,
            sortBy = "createdAt",
            sortDir = "desc",
            status,
            upcoming,
            search,
            startDate,
            endDate,
        } = query;

        if (!Types.ObjectId.isValid(vendorId)) {
            throw new BadRequestException("Invalid vendorId");
        }

        const skip = (page - 1) * limit;
        const sort: Record<string, 1 | -1> = { [sortBy]: sortDir === "asc" ? 1 : -1 };

        // Base filter: only orders that contain addons for this vendor
        const filters: any = {
            "addons.addOnVendorId": new Types.ObjectId(vendorId)
        };

        // Status
        if (status) filters.status = status;

        // Date range
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        // Search
        if (search) {
            const s = search.trim();
            if (Types.ObjectId.isValid(s)) {
                filters.$or = [
                    { _id: new Types.ObjectId(s) },
                    { orderNumber: { $regex: s, $options: "i" } }
                ];
            } else {
                filters.orderNumber = { $regex: s, $options: "i" };
            }
        }

        // Upcoming
        if (upcoming === true) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of current day

            filters.status = { $in: ["paid", "processing", "confirmed"] };
            filters.eventBookingDate = { $gte: today };
        }

        return await this.orderModel.aggregate([

            { $match: filters },

            // -------------------------
            // LOOKUP ALL ADDONS
            // -------------------------
            {
                $lookup: {
                    from: "addons",
                    let: { ids: "$addons.addOnId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $in: ["$_id", "$$ids"] }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                tiers: 1,
                                addOnVendorId: 1,
                                banner: 1
                            }
                        }
                    ],
                    as: "addonsData"
                }
            },



            // ------------------------------------
            // USER LOOKUP → ONLY SELECTED ADDRESS
            // ------------------------------------
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                firstName: 1,
                                lastName: 1,
                                email: 1,
                                mobile: 1,
                                addresses: 1
                            }
                        }
                    ]
                }
            },

            { $addFields: { userBase: { $arrayElemAt: ["$userData", 0] } } },

            {
                $addFields: {
                    userDetails: {
                        fullName: "$userBase.fullName",
                        firstName: "$userBase.firstName",
                        lastName: "$userBase.lastName",
                        email: "$userBase.email",
                        mobile: "$userBase.mobile",

                        // ONLY MATCHED ADDRESS
                        address: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: "$userBase.addresses",
                                        as: "addr",
                                        cond: { $eq: ["$$addr._id", "$addressId"] }
                                    }
                                },
                                0
                            ]
                        }
                    }
                }
            },

            { $project: { userBase: 0, userData: 0 } },
            // -------------------------
            // MERGE ADDON DETAILS
            // AND FILTER ONLY VENDOR-OWNED ADDONS
            // -------------------------
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "a",
                            in: {
                                $mergeObjects: [
                                    "$$a",
                                    {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: "$addonsData",
                                                    as: "ad",
                                                    cond: {
                                                        $and: [
                                                            { $eq: ["$$ad._id", "$$a.addOnId"] },
                                                            { $eq: ["$$a.addOnVendorId", vendorId] }
                                                        ]
                                                    }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            // Remove non-vendor addons (null entries)
            {
                $addFields: {
                    addons: {
                        $filter: {
                            input: "$addons",
                            as: "ad",
                            cond: { $eq: ["$$ad.addOnVendorId", vendorId] }
                        }
                    }
                }
            },

            // -------------------------
            // FILTER TIER INSIDE ADDONS
            // -------------------------
            {
                $addFields: {
                    addons: {
                        $map: {
                            input: "$addons",
                            as: "addon",
                            in: {
                                $mergeObjects: [
                                    "$$addon",
                                    {
                                        tiers: {
                                            $filter: {
                                                input: "$$addon.tiers",
                                                as: "t",
                                                cond: { $eq: ["$$t._id", "$$addon.selectedTier.tierId"] }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            // ------------------------------------
            // VENDOR LOOKUP
            // ------------------------------------
            {
                $lookup: {
                    from: "vendors",
                    localField: "vendorId",
                    foreignField: "_id",
                    as: "vendorLookup",
                    pipeline: [
                        {
                            $project: {
                                businessName: 1,
                                email: 1,
                                phone: 1,
                                city: 1
                            }
                        }
                    ]
                }
            },

            { $addFields: { vendorDetails: { $arrayElemAt: ["$vendorLookup", 0] } } },
            { $project: { vendorLookup: 0 } },

            // -------------------------
            // FINAL PROJECTION
            // -------------------------
            {
                $project: {
                    _id: 1,
                    orderNumber: 1,
                    userId: 1,
                    vendorId: 1,
                    event: 1,
                    eventDate: 1,
                    eventTime: 1,
                    timeSlot: 1,
                    userDetails: 1,
                    vendorDetails: 1,
                    selectedTier: 1,
                    status: 1,
                    orderStatus: 1,
                    totalAmount: 1,
                    createdAt: 1,

                    // only vendor addons
                    addons: 1,

                    addressDetails: { city: "$addressDetails.city" }
                }
            },

            // -------------------------
            // PAGINATION
            // -------------------------
            { $sort: sort },
            { $skip: skip },
            { $limit: limit },

            {
                $facet: {
                    data: [{ $match: {} }],
                    metadata: [
                        { $count: "total" },
                        { $addFields: { page, limit } }
                    ]
                }
            },
            {
                $addFields: {
                    metadata: {
                        $ifNull: [
                            { $arrayElemAt: ["$metadata", 0] },
                            { total: 0, page, limit }
                        ]
                    }
                }
            }


        ])
            .then((res) => ({
                results: res[0].data,
                totalResults: res[0].metadata.total,
                page: res[0].metadata.page,
                limit: res[0].metadata.limit,
                totalPages: Math.ceil(res[0].metadata.total / limit)
            }));
    }



    async getUserOrderCount(userId: Types.ObjectId) {
        const today = new Date().toISOString().slice(0, 10);
        console.log("Today date is :", today);
        // Fastest way → run both queries in parallel
        const [totalOrders, upcomingBookings] = await Promise.all([
            this.orderModel.countDocuments({ userId }),

            this.orderModel.countDocuments({
                userId,
                status: { $in: ["paid", "processing", "confirmed"] },
                eventBookingDate: { $gte: today },   // FIXED: compare eventDate (string) not eventBookingDate
            })
        ]);

        return {
            userId,
            totalOrders,
            upcomingBookings
        };
    }

    /**
     * Update order by admin
     * Allows admin to update order details including:
     * - Order status, vendor assignment
     * - Event details, tier, addons
     * - Date, time, address
     * - Pricing information
     */
    async updateOrderByAdmin(
        orderId: Types.ObjectId,
        updateDto: any,
    ) {
        console.log('================ ADMIN UPDATE ORDER ================');
        console.log('➡️ Order ID:', orderId);
        console.log('➡️ Update DTO:', JSON.stringify(updateDto, null, 2));

        // Check if order exists and populate user for email
        const order = await this.orderModel.findById(orderId).populate('userId', 'email firstName lastName mobile');
        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        console.log('✅ Order found:', {
            orderNumber: order.orderNumber,
            currentStatus: order.status,
        });

        // Store old values for comparison
        const oldEventDate = order.eventDate;
        const oldEventTime = order.eventTime;
        const oldDateTime = oldEventDate && oldEventTime ? `${oldEventDate} ${oldEventTime}` : '';
        const oldVenue = order.addressDetails?.address;
        const oldAmount = order.totalAmount;

        // Prepare update object
        const updateData: any = {};

        /* -------------------------------------------------
         * 1️⃣ Basic fields
         * ------------------------------------------------- */
        if (updateDto.status !== undefined) {
            updateData.status = updateDto.status;
            console.log('📝 Updating status:', updateDto.status);
        }

        if (updateDto.orderStatus !== undefined) {
            updateData.orderStatus = updateDto.orderStatus;
            console.log('📝 Updating orderStatus:', updateDto.orderStatus);
        }

        if (updateDto.vendorId !== undefined) {
            updateData.vendorId = updateDto.vendorId;
            console.log('📝 Updating vendorId:', updateDto.vendorId);
        }

        /* -------------------------------------------------
         * 2️⃣ Event details
         * ------------------------------------------------- */
        if (updateDto.event !== undefined) {
            updateData.event = {
                ...order.event,
                ...updateDto.event,
            };
            console.log('📝 Updating event:', updateData.event);
        }

        /* -------------------------------------------------
         * 3️⃣ Selected tier
         * ------------------------------------------------- */
        if (updateDto.selectedTier !== undefined) {
            updateData.selectedTier = {
                ...order.selectedTier,
                ...updateDto.selectedTier,
            };
            console.log('📝 Updating selectedTier:', updateData.selectedTier);
        }

        /* -------------------------------------------------
         * 4️⃣ Addons
         * ------------------------------------------------- */
        if (updateDto.addons !== undefined) {
            updateData.addons = updateDto.addons;
            console.log('📝 Updating addons:', updateData.addons.length, 'addons');
        }

        /* -------------------------------------------------
         * 5️⃣ Date and time
         * ------------------------------------------------- */
        if (updateDto.eventDate !== undefined) {
            updateData.eventDate = updateDto.eventDate;
            console.log('📝 Updating eventDate:', updateDto.eventDate);
        }

        if (updateDto.eventTime !== undefined) {
            updateData.eventTime = updateDto.eventTime;
            console.log('📝 Updating eventTime:', updateDto.eventTime);
        }

        // Calculate eventBookingDate if both date and time are provided
        if (updateDto.eventDate && updateDto.eventTime) {
            const dateStr = updateDto.eventDate;
            const timeStr = updateDto.eventTime;

            // Parse time (supports formats like "10:30 PM", "22:30")
            const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (timeParts) {
                let hours = parseInt(timeParts[1]);
                const minutes = parseInt(timeParts[2]);
                const meridiem = timeParts[3];

                if (meridiem) {
                    if (meridiem.toUpperCase() === 'PM' && hours !== 12) {
                        hours += 12;
                    } else if (meridiem.toUpperCase() === 'AM' && hours === 12) {
                        hours = 0;
                    }
                }

                updateData.eventBookingDate = new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000Z`);
                console.log('📝 Updating eventBookingDate:', updateData.eventBookingDate);
            }
        }

        /* -------------------------------------------------
         * 6️⃣ Address
         * ------------------------------------------------- */
        if (updateDto.addressDetails !== undefined) {
            updateData.addressDetails = {
                ...order.addressDetails,
                ...updateDto.addressDetails,
            };
            console.log('📝 Updating addressDetails');
        }

        if (updateDto.addressId !== undefined) {
            updateData.addressId = updateDto.addressId;
            console.log('📝 Updating addressId:', updateDto.addressId);
        }

        /* -------------------------------------------------
         * 7️⃣ Pricing - Auto-calculate from tier and addons
         * ------------------------------------------------- */

        // Get the final tier (either updated or existing)
        const finalTier = updateData.selectedTier || order.selectedTier;

        // Get the final addons (either updated or existing)
        const finalAddons = updateData.addons !== undefined ? updateData.addons : order.addons;

        // Calculate baseAmount from tier price
        if (finalTier?.price !== undefined) {
            updateData.baseAmount = Number(finalTier.price) || 0;
            console.log('💰 Calculated baseAmount from tier:', updateData.baseAmount);
        } else {
            updateData.baseAmount = order.baseAmount || 0;
            console.log('💰 Using existing baseAmount:', updateData.baseAmount);
        }

        // Calculate addonsAmount from sum of all addon tier prices
        if (finalAddons && Array.isArray(finalAddons)) {
            updateData.addonsAmount = finalAddons.reduce((sum, addon) => {
                const addonPrice = addon?.selectedTier?.price || 0;
                return sum + Number(addonPrice);
            }, 0);
            console.log('💰 Calculated addonsAmount from addons:', updateData.addonsAmount, `(${finalAddons.length} addons)`);
        } else {
            updateData.addonsAmount = order.addonsAmount || 0;
            console.log('💰 Using existing addonsAmount:', updateData.addonsAmount);
        }

        // Allow admin to override discount
        if (updateDto.discount !== undefined) {
            updateData.discount = Number(updateDto.discount) || 0;
            console.log('💰 Updating discount:', updateData.discount);
        } else {
            updateData.discount = order.discount || 0;
            console.log('💰 Using existing discount:', updateData.discount);
        }

        // Calculate subtotal = baseAmount + addonsAmount
        updateData.subtotal = updateData.baseAmount + updateData.addonsAmount;
        console.log('💰 Calculated subtotal:', updateData.subtotal, `(${updateData.baseAmount} + ${updateData.addonsAmount})`);

        // Calculate totalAmount = subtotal - discount
        updateData.totalAmount = updateData.subtotal - updateData.discount;
        console.log('💰 Calculated totalAmount:', updateData.totalAmount, `(${updateData.subtotal} - ${updateData.discount})`);

        // Note: We ignore any baseAmount, addonsAmount, subtotal, or totalAmount from frontend
        // These are always calculated server-side for security and consistency

        /* -------------------------------------------------
         * 8️⃣ Perform the update
         * ------------------------------------------------- */
        console.log('💾 Updating order in database...');

        const updatedOrder = await this.orderModel.findByIdAndUpdate(
            orderId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('userId', 'email firstName lastName mobile');

        if (!updatedOrder) {
            throw new NotFoundException(`Failed to update order with ID ${orderId}`);
        }

        console.log('✅ Order updated successfully');

        /* -------------------------------------------------
         * 9️⃣ Emit booking.updated event
         * ------------------------------------------------- */
        const user = updatedOrder.userId as any;
        const userEmail = user?.email || '';
        const userMobile = user?.mobile

        const newEventDate = updatedOrder.eventDate || oldEventDate;
        const newEventTime = updatedOrder.eventTime || oldEventTime;
        const newDateTime = newEventDate && newEventTime ? `${newEventDate} ${newEventTime}` : '';
        const newVenue = updatedOrder.addressDetails?.address || oldVenue;
        const newAmount = updatedOrder.totalAmount;

        logger.info(`📩 [Order] Emitting booking.updated event for order ${updatedOrder.orderNumber}`);
        console.log('📧 Emitting booking.updated event');

        this.eventEmitter.emit('booking.updated', {
            bookingId: updatedOrder.orderNumber,
            eventName: updatedOrder.event?.eventTitle || 'N/A',
            eventDateTime: newDateTime,
            venue: newVenue || 'N/A',
            partnerName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'N/A',
            bookingStatus: updatedOrder.status,
            oldDateTime: oldDateTime,
            newDateTime: newDateTime,
            oldVenue: oldVenue,
            newVenue: newVenue,
            oldAmount: oldAmount,
            newAmount: newAmount,
            email: userEmail,
            mobile: userMobile,
            userName: user?.firstName
        });

        logger.info(`✅ [Order] booking.updated event emitted for order ${updatedOrder.orderNumber}`);
        console.log('✅ Event emitted successfully');
        console.log('================ ADMIN UPDATE ORDER END ================');

        return updatedOrder;
    }


}
