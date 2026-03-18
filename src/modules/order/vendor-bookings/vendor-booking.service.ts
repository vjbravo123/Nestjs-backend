import { Injectable, BadRequestException, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AddOnService } from '../../addOn/addon.service'
import { VendorBooking } from './vendor-booking.schema';
import { VendorBookingsQueryDto } from '../dto/vendor-bookings-query.dto';
import { OrderService } from '../order.service'
import { VendorService } from 'src/modules/vendor/vendor.service';
import { VendorAvailabilityService } from '../../vendoravailability/vendor-availability.service'
import * as PDFDocument from 'pdfkit';
import { ForbiddenException } from '@nestjs/common';
@Injectable()
export class VendorBookingService {
    constructor(
        @InjectModel(VendorBooking.name)
        private readonly vendorBookingModel: Model<VendorBooking>,
        @Inject(forwardRef(() => AddOnService)) private readonly addOnService: AddOnService,
        @Inject(forwardRef(() => OrderService)) private readonly orderService: OrderService,
        private readonly vendorAvailabilityService: VendorAvailabilityService
    ) { }

  


    async createVendorBookingsFromOrders(
        orders: any[],
        checkoutBatchId: Types.ObjectId,
        session: any,
    ) {
        if (!orders?.length) return;

        // -------------------------------------------------
        // Idempotency: if this batch already processed → skip
        // -------------------------------------------------
        const existingCount = await this.vendorBookingModel.countDocuments(
            { checkoutBatchId },
            { session },
        );

        if (existingCount > 0) return;


        const vendorBookings: any[] = [];

        // Prevent duplicate vendor+item combinations
        const uniqueKey = new Set<string>();

        for (const order of orders) {
            const {
                _id: orderId,
                orderNumber,
                userId,
                vendorId,
                event,
                selectedTier,
                addons,
                eventDate,

                eventBookingDate,
                eventTime,
                addressDetails,
                baseAmount,
            } = order;

            // =================================================
            // MAIN EVENT VENDOR
            // =================================================
            if (event?.eventCategory !== 'AddOn' && vendorId) {
                const key = `${vendorId}_${event.eventId}`;

                if (!uniqueKey.has(key)) {
                    uniqueKey.add(key);

                    vendorBookings.push({
                        orderId,
                        orderNumber,
                        userId,
                        checkoutBatchId,
                        eventBookingDate,
                        vendorId,
                        bookingType: 'event',
                        itemId: event.eventId,
                        eventCategory: event.eventCategory,
                        title: event.eventTitle,

                        tierSnapshot: selectedTier,
                        eventDate,
                        eventTime,
                        addressDetails,

                        amount: Number(baseAmount) || 0,
                        status: 'pending',
                        payoutStatus: 'pending',
                    });
                }
            }

            // =================================================
            // ADDON VENDORS (slot aware pricing)
            // =================================================
            for (const addon of addons || []) {
                if (!addon?.addOnVendorId) continue;

                const slotMultiplier =
                    addon.selectedTier?.slots?.reduce(
                        (sum: number, s: any) => sum + (s.quantity || 1),
                        0,
                    ) || 1;

                const addonAmount =
                    (Number(addon.selectedTier?.price) || 0) * slotMultiplier;

                const key = `${addon.addOnVendorId}_${addon.addOnId}_${addon.selectedTier?.tierId}`;

                if (uniqueKey.has(key)) continue;
                uniqueKey.add(key);

                vendorBookings.push({
                    orderId,
                    orderNumber,
                    userId,
                    checkoutBatchId,

                    vendorId: addon.addOnVendorId,
                    bookingType: 'addon',
                    itemId: addon.addOnId,
                    eventCategory: 'AddOn',
                    title: addon.name,

                    tierSnapshot: addon.selectedTier,
                    eventDate,
                    eventTime,
                    addressDetails,

                    amount: addonAmount,
                    status: 'pending',
                    payoutStatus: 'pending',
                });
            }
        }

        if (!vendorBookings.length) return;

        // -------------------------------------------------
        // Single bulk insert
        // -------------------------------------------------
        await this.vendorBookingModel.insertMany(vendorBookings, { session });
    }



    async getOrdersForVendor(vendorId: Types.ObjectId, query: any) {
        const {
            page = 1,
            limit = 25,
            sortBy = "createdAt",
            sortDir = "desc",
            startDate,
            endDate,
            search,
            upcoming,
            recentBooking,
            orderStatus,
            eventCategory
        } = query;

        const skip = (Number(page) - 1) * Number(limit);

        const filters: any = {
            vendorId: new Types.ObjectId(vendorId)
        };

        if (startDate || endDate) {
            const dateFilter: any = {};
            if (startDate) dateFilter.$gte = startDate;
            if (endDate) dateFilter.$lte = endDate;
            filters.eventDate = dateFilter;
        }

        if (upcoming === true || upcoming === "true") {
            const today = new Date().toISOString().split('T')[0];
            filters.eventDate = { $gte: today };
        }

        if (recentBooking === true || recentBooking === "true") {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            filters.createdAt = { $gte: sevenDaysAgo };
        }

        if (orderStatus) {
            const statuses = orderStatus.split(",").map((s: string) => s.trim());
            filters.status = { $in: statuses };
        }

        if (eventCategory) {
            filters.eventCategory = eventCategory;
        }

        console.log("vendor booking filter", filters)
        return this.vendorBookingModel.aggregate([

            /* MATCH */
            { $match: filters },

            /* LOOKUP USER */
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
                                email: 1
                            }
                        }
                    ]
                }
            },
            { $unwind: "$user" },

            /* SEARCH */
            ...(search ? [{
                $match: {
                    $or: [
                        { orderNumber: { $regex: search, $options: "i" } },
                        { "user.firstName": { $regex: search, $options: "i" } },
                        { "user.lastName": { $regex: search, $options: "i" } },
                        { "user.mobile": { $regex: search, $options: "i" } }
                    ]
                }
            }] : []),

            /* 🔥 GROUP BY ORDER */
            {
                $group: {
                    _id: "$orderId",

                    orderNumber: { $first: "$orderNumber" },
                    checkoutBatchId: { $first: "$checkoutBatchId" },
                    user: { $first: "$user" },
                    userId: { $first: "$userId" },
                    addressDetails: { $first: "$addressDetails" },
                    eventDate: { $first: "$eventDate" },
                    eventBookingDate: { $first: "$eventBookingDate" },
                    eventTime: { $first: "$eventTime" },
                    status: { $first: "$status" },
                    createdAt: { $first: "$createdAt" },

                    bookings: {
                        $push: {
                            type: "$bookingType",
                            eventCategory: "$eventCategory",
                            itemId: "$itemId",
                            title: "$title",
                            tier: "$tierSnapshot",
                            // amount: "$amount"
                        }
                    },

                    // totalAmount: { $sum: "$amount" }
                }
            },

            /* SORT */
            { $sort: { [sortBy]: sortDir === "desc" ? -1 : 1 } },

            /* PAGINATION */
            { $skip: skip },
            { $limit: Number(limit) }
        ]);
    }



    async getAddonUnavailableDates(dto: {
        eventId: Types.ObjectId;
        city: string;
        month: number;
        year: number;
    }) {
        const { eventId, city, month, year } = dto;

        console.log('STEP 0 → input:', {
            eventId,
            city,
            month,
            year,
            eventIdType: typeof eventId,
        });

        // ===============================
        // 1️⃣ Load AddOn
        // ===============================
        const addon = await this.addOnService.getAddonById(eventId.toString());

        console.log('STEP 1 → addon fetched:', !!addon);

        if (!addon) {
            throw new BadRequestException('Addon not found');
        }

        // ===============================
        // 2️⃣ Extract city config
        // ===============================
        const cityConfig = addon.cityOfOperation?.find(
            c => c.name.toLowerCase() === city.toLowerCase(),
        );

        console.log('STEP 2 → cityConfig found:', !!cityConfig);

        if (!cityConfig) throw new NotFoundException("currently  service not available in the location ");

        // ===============================
        // 3️⃣ Slot limits
        // ===============================
        const slotLimits: Record<string, number> = {};
        cityConfig.slots.forEach(s => {
            slotLimits[s.slotType] = s.maxSlotBookingsPerDay;
        });

        const allSlotTypes = Object.keys(slotLimits);

        console.log('STEP 3 → slotLimits:', slotLimits);

        // ===============================
        // 4️⃣ Date window logic
        // ===============================
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 0));

        const start =
            today > monthStart ? new Date(today) : new Date(monthStart);

        const end = new Date(monthEnd);
        end.setUTCDate(end.getUTCDate() + 7);

        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);

        console.log('STEP 4 → date range:', { startStr, endStr });

        // ===============================
        // 5️⃣ Vendor unavailable dates
        // ===============================
        if (!addon.createdBy) {
            throw new Error('Addon has no vendor (createdBy missing)');
        }

        const vendorId = new Types.ObjectId(addon.createdBy);

        console.log('STEP 5 → vendorId:', vendorId.toHexString());

        const unavailable: string[] = [];

        try {
            console.log('STEP 6 → calling vendorAvailabilityService');

            const vendorResult =
                await this.vendorAvailabilityService.getUnavailableDatesByRange(
                    vendorId,
                    startStr,
                    endStr,
                );

            const vendorUnavailableDates: string[] =
                vendorResult?.unavailableDates || [];

            console.log(
                'STEP 7 → vendor unavailable dates:',
                vendorUnavailableDates,
            );

            // merge vendor unavailable dates
            unavailable.push(...vendorUnavailableDates);
        } catch (error) {
            console.error(
                'ERROR → vendorAvailabilityService:',
                error?.message || error,
            );
        }

        // ===============================
        // 6️⃣ Aggregate VendorBookings
        // ===============================
        console.log('STEP 8 → aggregating vendor bookings');

        const bookings = await this.vendorBookingModel.aggregate([
            {
                $match: {
                    bookingType: 'addon',
                    itemId: new Types.ObjectId(eventId),
                    status: 'pending',
                    'addressDetails.city': city,
                    eventDate: { $gte: startStr, $lte: endStr },
                },
            },
            { $unwind: '$tierSnapshot.slots' },
            {
                $group: {
                    _id: {
                        date: '$eventDate',
                        slot: '$tierSnapshot.slots.slotType',
                    },
                    totalQty: {
                        $sum: { $ifNull: ['$tierSnapshot.slots.quantity', 1] },
                    },
                },
            },
        ]);

        console.log('STEP 9 → aggregated bookings count:', bookings.length);

        // ===============================
        // 7️⃣ Build date → slot map
        // ===============================
        const dateMap: Record<string, Record<string, number>> = {};

        for (const row of bookings) {
            const date = row._id.date;
            const slot = row._id.slot;

            if (!dateMap[date]) dateMap[date] = {};
            dateMap[date][slot] = row.totalQty;
        }

        console.log('STEP 10 → dateMap:', dateMap);

        // ===============================
        // 8️⃣ Fully booked days
        // ===============================
        for (const [date, slotCounts] of Object.entries(dateMap)) {
            const fullyBooked = allSlotTypes.every(slot => {
                const booked = slotCounts[slot] || 0;
                const limit = slotLimits[slot] || 0;
                return booked >= limit;
            });

            if (fullyBooked) {
                unavailable.push(date);
            }
        }

        // ===============================
        // 9️⃣ Final merge & return
        // ===============================
        const finalUnavailableDates = Array.from(
            new Set(unavailable),
        ).sort();

        console.log(
            'STEP 11 → FINAL unavailable dates:',
            finalUnavailableDates,
        );

        return finalUnavailableDates;
    }


    async getAddonAvailableSlots(dto: {
        eventId: Types.ObjectId; // addonId
        city: string;
        date: string; // YYYY-MM-DD
    }) {
        const { eventId, city, date } = dto;

        console.log('STEP 0 → input:', { eventId, city, date });

        // ===============================
        // 1️⃣ Load AddOn
        // ===============================
        const addon = await this.addOnService.getAddonById(eventId.toString());

        console.log('STEP 1 → addon fetched:', !!addon);

        if (!addon) {
            throw new BadRequestException('Addon not found');
        }

        // ===============================
        // 2️⃣ Extract city config
        // ===============================
        const cityConfig = addon.cityOfOperation?.find(
            c => c.name.toLowerCase() === city.toLowerCase(),
        );

        console.log('STEP 2 → cityConfig found:', !!cityConfig);

        if (!cityConfig) {
            throw new BadRequestException('City not supported for this addon');
        }

        /**
         * Build capacity map
         * { breakfast: 5, lunch: 5, tea: 5, dinner: 5 }
         */
        const slotCapacity: Record<string, number> = {};
        cityConfig.slots.forEach(s => {
            slotCapacity[s.slotType] = s.maxSlotBookingsPerDay;
        });

        console.log('STEP 3 → slotCapacity:', slotCapacity);

        // ===============================
        // 3️⃣ Vendor availability
        // ===============================
        const vendorAvailability =
            await this.vendorAvailabilityService.getAvailability(
                new Types.ObjectId(addon.createdBy),
            );

        console.log('STEP 3.1 → vendorAvailability:', vendorAvailability);

        // get numeric day (0-6)
        const dayOfWeek = new Date(date).getDay();

        console.log('STEP 3.2 → dayOfWeek:', dayOfWeek);

        // check vendor works this day
        const vendorWorksToday =
            vendorAvailability?.weeklyAvailableDays?.includes(dayOfWeek);

        console.log('STEP 3.3 → vendorWorksToday:', vendorWorksToday);

        let vendorAvailableSlots: string[] = [];

        if (vendorWorksToday) {
            const vendorDayConfig = vendorAvailability?.weeklySlots?.find(
                (d: any) => d.day === dayOfWeek,
            );

            console.log('STEP 3.4 → vendorDayConfig:', vendorDayConfig);

            if (vendorDayConfig?.slots?.length) {
                vendorAvailableSlots = vendorDayConfig.slots;
            }
        }

        console.log('STEP 3.5 → vendorAvailableSlots:', vendorAvailableSlots);

        // ===============================
        // 4️⃣ Aggregate bookings for date
        // ===============================
        const bookings = await this.vendorBookingModel.aggregate([
            {
                $match: {
                    bookingType: 'addon',
                    itemId: new Types.ObjectId(eventId),
                    status: 'pending',
                    'addressDetails.city': city,
                    eventDate: date,
                },
            },
            { $unwind: '$tierSnapshot.slots' },
            {
                $group: {
                    _id: '$tierSnapshot.slots.slotType',
                    bookedQty: {
                        $sum: { $ifNull: ['$tierSnapshot.slots.quantity', 1] },
                    },
                },
            },
        ]);

        console.log('STEP 4 → aggregated bookings:', bookings);

        /**
         * bookedMap example:
         * { breakfast: 2, lunch: 5 }
         */
        const bookedMap: Record<string, number> = {};
        bookings.forEach(b => {
            bookedMap[b._id] = b.bookedQty;
        });

        console.log('STEP 4.5 → bookedMap:', bookedMap);

        // ===============================
        // 5️⃣ Calculate remaining slots
        // ===============================
        const availableSlots = Object.entries(slotCapacity).map(
            ([slotType, maxQty]) => {

                const vendorAllowsSlot = vendorAvailableSlots.includes(slotType);

                const booked = bookedMap[slotType] || 0;

                const remaining = vendorAllowsSlot
                    ? Math.max(maxQty - booked, 0)
                    : 0;

                console.log(`STEP 5 → slot check`, {
                    slotType,
                    vendorAllowsSlot,
                    maxQty,
                    booked,
                    remaining,
                });

                return {
                    slotType,
                    maxQty,
                    bookedQty: booked,
                    remainingQty: remaining,
                    isAvailable: vendorAllowsSlot && remaining > 0,
                };
            },
        );

        console.log('STEP 6 → availableSlots:', availableSlots);

        return {
            date,
            city,
            addonId: eventId,
            isQuantityRequired: addon.isQuantityRequired,
            availableSlots,
        };
    }

    async getNextUpcomingVendorBookings(vendorId: Types.ObjectId) {
        const today = new Date().toISOString().split('T')[0];

        return this.vendorBookingModel.aggregate([
            /* ----------------------------------------------------
             * 1️⃣ MATCH
             * ---------------------------------------------------- */
            {
                $match: {
                    vendorId: new Types.ObjectId(vendorId),
                    eventDate: { $gte: today },
                    status: { $in: ['pending', 'accepted', 'completed'] },
                },
            },

            /* ----------------------------------------------------
             * 2️⃣ SORT BY DATE + TIME
             * ---------------------------------------------------- */
            {
                $sort: {
                    eventDate: 1,
                    eventTime: 1,
                },
            },

            /* ----------------------------------------------------
             * 3️⃣ GROUP SAME EVENT (DATE + TIME + ORDER)
             * ---------------------------------------------------- */
            {
                $group: {
                    _id: {
                        eventDate: "$eventDate",
                        eventTime: "$eventTime",
                        orderId: "$orderId",
                    },

                    bookings: {
                        $push: {
                            type: "$eventCategory",
                            eventId: {
                                $cond: [
                                    { $eq: ["$bookingType", "event"] },
                                    "$itemId",
                                    "$$REMOVE",
                                ],
                            },
                            addOnId: {
                                $cond: [
                                    { $eq: ["$bookingType", "addon"] },
                                    "$itemId",
                                    "$$REMOVE",
                                ],
                            },
                            title: "$title",
                            tier: "$tierSnapshot",
                            amount: "$amount",
                        },
                    },

                    totalAmount: { $sum: "$amount" },

                    addressDetails: { $first: "$addressDetails" },
                    userId: { $first: "$userId" },
                    status: { $first: "$status" },
                },
            },

            /* ----------------------------------------------------
             * 4️⃣ PICK NEAREST EVENT
             * ---------------------------------------------------- */
            {
                $sort: {
                    "_id.eventDate": 1,
                    "_id.eventTime": 1,
                },
            },
            { $limit: 1 },

            /* ----------------------------------------------------
             * 5️⃣ USER LOOKUP
             * ---------------------------------------------------- */
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
                            },
                        },
                    ],
                },
            },
            { $unwind: "$user" },

            /* ----------------------------------------------------
             * 6️⃣ FINAL FORMAT
             * ---------------------------------------------------- */
            {
                $project: {
                    _id: 0,

                    status: {
                        paymentStatus: "$status",
                    },

                    dateTime: {
                        date: {
                            $dateToString: {
                                format: "%d %b, %Y",
                                date: {
                                    $dateFromString: {
                                        dateString: "$_id.eventDate",
                                    },
                                },
                            },
                        },
                        time: "$_id.eventTime",
                        eventBookingDate: {
                            $dateFromString: {
                                dateString: "$_id.eventDate",
                            },
                        },
                    },

                    venue: {
                        name: "$addressDetails.address",
                        city: "$addressDetails.city",
                        state: "$addressDetails.state",
                    },

                    revenue: {
                        totalAmount: "$totalAmount",
                    },

                    primaryContact: {
                        name: {
                            $concat: [
                                "$user.firstName",
                                " ",
                                "$user.lastName",
                            ],
                        },
                        mobile: "$user.mobile",
                    },

                    bookings: 1,
                },
            },
        ]);
    }

    async getVendorBookingDetails(
        vendorId: Types.ObjectId,
        bookingId: Types.ObjectId,
    ) {
        console.log("both ids", vendorId, bookingId);

        // -----------------------------
        // Validate bookingId
        // -----------------------------
        if (!Types.ObjectId.isValid(bookingId)) {
            throw new BadRequestException('Invalid booking id');
        }

        const booking = await this.vendorBookingModel.aggregate([

            // -----------------------------
            // MATCH BOOKING
            // -----------------------------
            {
                $match: {
                    _id: new Types.ObjectId(bookingId),
                    vendorId: new Types.ObjectId(vendorId)
                }
            },

            // -----------------------------
            // USER DETAILS
            // -----------------------------
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
                                email: 1
                            }
                        }
                    ]
                }
            },
            { $unwind: "$user" },

            // -----------------------------
            // CONDITIONAL ORDER LOOKUP
            // Only if bookingType = event
            // -----------------------------
            {
                $lookup: {
                    from: "orders",
                    let: {
                        orderId: "$orderId",
                        bookingType: "$bookingType"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$_id", "$$orderId"] },
                                        { $eq: ["$$bookingType", "event"] }
                                    ]
                                }
                            }
                        },
                        {
                            $project: {

                                _id: 1,
                                orderNumber: 1,
                                orderStatus: 1,
                                paymentStatus: 1,

                                event: {
                                    eventId: "$event.eventId",
                                    eventTitle: "$event.eventTitle",
                                    eventCategory: "$event.eventCategory"
                                },

                                eventDate: 1,
                                eventTime: 1,
                                eventBookingDate: 1,

                                addressDetails: {
                                    name: "$addressDetails.name",
                                    mobile: "$addressDetails.mobile",
                                    city: "$addressDetails.city",
                                    state: "$addressDetails.state",
                                    address: "$addressDetails.address",
                                    pincode: "$addressDetails.pincode"
                                },

                                pricing: {
                                    subtotal: "$subtotal",
                                    addonsAmount: "$addonsAmount",
                                    totalAmount: "$totalAmount"
                                },

                                payment: {
                                    method: "$paymentDetails.method",
                                    status: "$paymentStatus"
                                }
                            }
                        }
                    ],
                    as: "order"
                }
            },

            {
                $unwind: {
                    path: "$order",
                    preserveNullAndEmptyArrays: true
                }
            },

            // -----------------------------
            // FINAL RESPONSE
            // -----------------------------
            {
                $project: {

                    _id: 1,
                    bookingType: 1,
                    eventCategory: 1,
                    itemId: 1,
                    title: 1,

                    tierSnapshot: 1,

                    eventDate: 1,
                    eventTime: 1,
                    eventBookingDate: 1,

                    addressDetails: 1,

                    amount: 1,
                    status: 1,
                    payoutStatus: 1,
                    vendorNote: 1,

                    createdAt: 1,

                    order: 1,

                    user: {
                        name: {
                            $concat: [
                                "$user.firstName",
                                " ",
                                "$user.lastName"
                            ]
                        },
                        mobile: "$user.mobile",
                        email: "$user.email"
                    }
                }
            }

        ]);

        if (!booking.length) {
            throw new NotFoundException('Vendor booking not found');
        }

        return booking[0];
    }


}
