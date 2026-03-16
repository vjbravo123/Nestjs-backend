import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../order.schema';
import { lookupAndUnwind } from '../../../common/utils/mongoose-lookup.util';

@Injectable()
export class VendorOrderService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async getOrdersForVendor(vendorId: Types.ObjectId, query: any) {
    const {
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortDir = 'desc',
      startDate,
      recentBooking,
      endDate,
      search,
      upcoming,
      orderStatus,
      timeSlot,
      eventCategory,
    } = query;
    console.log('query in get order list by vendor ', query);
    const skip = (page - 1) * limit;

    /** ----------------------------------------------------
     * BUILD FILTERS
     * ---------------------------------------------------- */
    const filters: any = {
      $or: [{ vendorId }, { 'addons.addOnVendorId': vendorId }],
    };

    // SEARCH FILTER
    if (search) {
      const s = search.trim();
      filters.$and = [
        {
          $or: [
            { orderNumber: { $regex: s, $options: 'i' } },
            { 'user.firstName': { $regex: s, $options: 'i' } },
            { 'user.lastName': { $regex: s, $options: 'i' } },
            { 'user.mobile': { $regex: s, $options: 'i' } },
          ],
        },
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
      console.log('inside the upcoming filter');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filters.status = { $in: ['paid', 'processing', 'confirmed'] };
      filters.eventBookingDate = { $gte: today };
    }

    if (recentBooking === true) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filters.createdAt = { $gte: sevenDaysAgo };
      filters.orderStatus = { $in: ['pending'] }; // FIXED: status, not orderStatus
    }

    // ORDER STATUS FILTER
    if (orderStatus) {
      const statuses = orderStatus.split(',').map((s: string) => s.trim());
      filters.status = { $in: statuses };
    }

    // EVENT CATEGORY FILTER
    if (eventCategory) {
      filters['event.eventCategory'] = eventCategory;
    }

    console.log('before apply filter', filters);

    /** ----------------------------------------------------
     * AGGREGATION PIPELINE
     * ---------------------------------------------------- */
    return this.orderModel.aggregate([
      /** FILTER ORDERS */
      { $match: filters },

      /** LOOKUP USER */
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                mobile: 1,
                role: 1,
                email: 1,
              },
            },
          ],
        },
      },
      { $unwind: '$user' },

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
              { $eq: ['$vendorId', vendorId] },
              {
                type: '$event.eventCategory',
                eventId: '$event.eventId',
                name: '$event.eventTitle',
                tier: '$selectedTier',
                amount: '$baseAmount',
              },
              null,
            ],
          },

          addonBookings: {
            $map: {
              input: '$addons',
              as: 'ad',
              in: {
                $cond: [
                  { $eq: ['$$ad.addOnVendorId', vendorId] },
                  {
                    type: 'addon',
                    addOnId: '$$ad.addOnId',
                    name: '$$ad.name',
                    tier: '$$ad.selectedTier',
                    amount: '$$ad.selectedTier.price',
                    eventId: '$event.eventId',
                    eventTitle: '$event.eventTitle',
                    eventCategory: '$event.eventCategory',
                  },
                  null,
                ],
              },
            },
          },
        },
      },

      /** MERGE EVENT + ADDONS */
      {
        $addFields: {
          bookings: {
            $filter: {
              input: {
                $concatArrays: [['$eventBooking'], '$addonBookings'],
              },
              as: 'b',
              cond: { $ne: ['$$b', null] },
            },
          },
        },
      },

      /** UNWIND MULTIPLE ROWS */
      { $unwind: '$bookings' },

      /** FINAL STRUCTURE */
      {
        $project: {
          orderId: '$_id',
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
          booking: '$bookings',
        },
      },

      /** SORT + PAGINATION */
      { $sort: { [sortBy]: sortDir === 'desc' ? -1 : 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);
  }

  async getOrderByIdForVendor(
    orderId: Types.ObjectId,
    vendorId: Types.ObjectId,
    bookingId: Types.ObjectId,
    type: 'event' | 'addon' | 'AddOn',
  ) {
    if (!Types.ObjectId.isValid(vendorId) || !Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid vendorId or orderId');
    }

    const result = await this.orderModel.aggregate([
      // -------------------------------------------------
      // MATCH ORDER FOR THIS VENDOR
      // -------------------------------------------------
      {
        $match: {
          _id: orderId,
          $or: [{ vendorId }, { 'addons.addOnVendorId': vendorId }],
        },
      },

      // -------------------------------------------------
      // USER LOOKUP
      // -------------------------------------------------
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },

      // -------------------------------------------------
      // EXTRACT MAIN EVENT IF OWNED BY VENDOR
      // -------------------------------------------------
      {
        $addFields: {
          mainEvent: {
            $cond: [
              { $eq: ['$vendorId', vendorId] },
              {
                eventId: '$event.eventId',
                eventTitle: '$event.eventTitle',
                tier: '$selectedTier',
                baseAmount: '$baseAmount',
              },
              null,
            ],
          },
        },
      },

      // -------------------------------------------------
      // FILTER ONLY THIS VENDOR'S ADDONS
      // -------------------------------------------------
      {
        $addFields: {
          vendorAddons: {
            $filter: {
              input: '$addons',
              as: 'ad',
              cond: { $eq: ['$$ad.addOnVendorId', vendorId] },
            },
          },
        },
      },

      // -------------------------------------------------
      // MAP VENDOR ADDONS
      // -------------------------------------------------
      {
        $addFields: {
          vendorAddons: {
            $map: {
              input: '$vendorAddons',
              as: 'ad',
              in: {
                type: 'addon',
                bookingId: '$$ad.addOnId',
                name: '$$ad.name',
                tier: '$$ad.selectedTier',
                amount: '$$ad.selectedTier.price',
              },
            },
          },
        },
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
                        { $ne: ['$mainEvent', null] },
                        {
                          type: 'event',
                          bookingId: '$mainEvent.eventId',
                          name: '$mainEvent.eventTitle',
                          tier: '$mainEvent.tier',
                          amount: '$mainEvent.baseAmount',
                        },
                        null,
                      ],
                    },
                  ],
                  '$vendorAddons',
                ],
              },
              as: 'b',
              cond: { $ne: ['$$b', null] },
            },
          },
        },
      },

      // -------------------------------------------------
      // PICK THIS (event/addon) BOOKING
      // -------------------------------------------------
      {
        $addFields: {
          selectedBooking: {
            $first: {
              $filter: {
                input: '$bookings',
                as: 'b',
                cond: {
                  $and: [
                    { $eq: ['$$b.type', type] },
                    { $eq: ['$$b.bookingId', bookingId] },
                  ],
                },
              },
            },
          },
        },
      },

      // -------------------------------------------------
      // LOOKUP EVENT DETAILS (IF EVENT)
      // -------------------------------------------------
      {
        $lookup: {
          from: 'experientialevents',
          let: { id: '$selectedBooking.bookingId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$id'] } } },

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
                subExperientialEventCategory: 1,
              },
            },
          ],
          as: 'eventDetails',
        },
      },

      // -------------------------------------------------
      // LOOKUP ADDON DETAILS (IF ADDON)
      // -------------------------------------------------
      {
        $lookup: {
          from: 'addons',
          let: { id: '$selectedBooking.bookingId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$id'] } } },
            {
              $project: {
                _id: 1,
                title: 1,
                images: 1,
                description: 1,
                category: 1,
              },
            },
          ],
          as: 'addonDetails',
        },
      },

      // -------------------------------------------------
      // SAFELY ATTACH EVENT DETAILS
      // -------------------------------------------------
      {
        $addFields: {
          eventData: { $arrayElemAt: ['$eventDetails', 0] },
        },
      },

      // -------------------------------------------------
      // LOOKUP: EXPERIENTIAL EVENT CATEGORY
      // -------------------------------------------------
      {
        $lookup: {
          from: 'dropdownoptions',
          let: {
            ids: {
              $cond: [
                { $isArray: '$eventData.experientialEventCategory' },
                '$eventData.experientialEventCategory',
                {
                  $ifNull: [
                    {
                      $cond: [
                        { $gt: ['$eventData.experientialEventCategory', null] },
                        ['$eventData.experientialEventCategory'],
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
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $project: { _id: 1, value: 1, label: 1, isActive: 1 } },
          ],
          as: 'eventCategoryData',
        },
      },

      // -------------------------------------------------
      // LOOKUP: SUB EXPERIENTIAL CATEGORY
      // -------------------------------------------------
      {
        $lookup: {
          from: 'subexperientialeventcategories',
          let: {
            ids: { $ifNull: ['$eventData.subExperientialEventCategory', []] },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            {
              $project: {
                _id: 1,
                name: 1,
                experientialEventCategoryId: 1,
              },
            },
          ],
          as: 'subEventCategoryData',
        },
      },

      // -------------------------------------------------
      // MERGE DETAILS INTO bookingDetails
      // -------------------------------------------------
      {
        $addFields: {
          bookingDetails: {
            $cond: [
              { $eq: ['$selectedBooking.type', 'event'] },
              {
                $mergeObjects: [
                  '$eventData',
                  {
                    experientialEventCategory: '$eventCategoryData',
                    subExperientialEventCategory: '$subEventCategoryData',
                  },
                ],
              },
              { $arrayElemAt: ['$addonDetails', 0] },
            ],
          },
        },
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
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            mobile: '$user.mobile',
          },

          booking: {
            type: '$selectedBooking.type',
            bookingId: '$selectedBooking.bookingId',
            name: '$selectedBooking.name',
            tier: '$selectedBooking.tier',
            amount: '$selectedBooking.amount',
            details: '$bookingDetails',
          },
        },
      },
    ]);

    if (!result.length || !result[0].booking) {
      throw new BadRequestException('Booking not found for this vendor');
    }

    return result[0];
  }

  async getNextUpcomingEventForVendor(vendorId: Types.ObjectId) {
    const now = new Date();

    return this.orderModel.aggregate([
      /* ----------------------------------------------------
       * 1️⃣ MATCH
       * ---------------------------------------------------- */
      {
        $match: {
          $or: [{ vendorId }, { 'addons.addOnVendorId': vendorId }],
          eventBookingDate: { $gt: now },
          status: { $in: ['paid', 'processing', 'confirmed'] },
        },
      },

      /* ----------------------------------------------------
       * 2️⃣ NORMALIZE DATE
       * ---------------------------------------------------- */
      {
        $addFields: {
          bookingDay: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$eventBookingDate',
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
          _id: '$bookingDay',
          orders: { $push: '$$ROOT' },
          nearestTime: { $first: '$eventBookingDate' },
        },
      },
      { $sort: { nearestTime: 1 } },
      { $limit: 1 },

      /* ----------------------------------------------------
       * 5️⃣ FLATTEN
       * ---------------------------------------------------- */
      { $unwind: '$orders' },
      { $replaceRoot: { newRoot: '$orders' } },

      /* ----------------------------------------------------
       * 6️⃣ USER LOOKUP
       * ---------------------------------------------------- */
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { firstName: 1, lastName: 1, mobile: 1 } }],
        },
      },
      { $unwind: '$user' },

      /* ----------------------------------------------------
       * 7️⃣ EXPERIENTIAL EVENT LOOKUP
       * ---------------------------------------------------- */
      ...lookupAndUnwind('event.eventId', 'experientialevents', '_id', {
        title: 1,
        banner: 1,
        experientialEventCategory: 1,
      }),

      /* ----------------------------------------------------
       * 8️⃣ ADDON LOOKUP
       * ---------------------------------------------------- */
      {
        $lookup: {
          from: 'addons',
          localField: 'addons.addOnId',
          foreignField: '_id',
          as: 'addonDetails',
          pipeline: [{ $project: { name: 1, banner: 1 } }],
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
              { $eq: ['$vendorId', vendorId] },
              {
                type: '$event.eventCategory',
                eventId: '$event.eventId',
                title: '$experientialevents.title',
                tier: '$selectedTier',
                amount: '$baseAmount',
                banner: '$experientialevents.banner',
              },
              null,
            ],
          },

          /* -------- ADDON BOOKINGS */
          addonBookings: {
            $filter: {
              input: {
                $map: {
                  input: '$addons',
                  as: 'ad',
                  in: {
                    $cond: [
                      { $eq: ['$$ad.addOnVendorId', vendorId] },
                      {
                        type: 'addon',
                        addOnId: '$$ad.addOnId',
                        title: '$$ad.name',
                        tier: '$$ad.selectedTier',
                        amount: '$$ad.selectedTier.price',
                        banner: {
                          $arrayElemAt: ['$addonDetails.banner', 0],
                        },
                      },
                      null,
                    ],
                  },
                },
              },
              as: 'a',
              cond: { $ne: ['$$a', null] },
            },
          },

          /* -------- COMMON UI */
          dateTime: {
            date: {
              $dateToString: {
                format: '%d %b, %Y',
                date: '$eventBookingDate',
              },
            },
            time: '$eventTime',
            eventBookingDate: '$eventBookingDate',
          },

          venue: {
            name: '$addressDetails.address',
            city: '$addressDetails.city',
            state: '$addressDetails.state',
          },

          revenue: { totalAmount: '$totalAmount' },

          primaryContact: {
            name: {
              $concat: ['$user.firstName', ' ', '$user.lastName'],
            },
            mobile: '$user.mobile',
          },

          status: {
            paymentStatus: '$status',
            orderStatus: '$orderStatus',
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
                      { $ne: ['$eventBooking', null] },
                      ['$eventBooking'],
                      [],
                    ],
                  },
                  '$addonBookings',
                ],
              },
              as: 'b',
              cond: { $ne: ['$$b', null] },
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

  async getOrdersEventForVendor(vendorId: Types.ObjectId, query: any) {
    const {
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortDir = 'desc',
      status,
      upcoming,
      search,
      startDate,
      endDate,
    } = query;

    if (!Types.ObjectId.isValid(vendorId)) {
      throw new BadRequestException('Invalid vendorId');
    }

    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortDir === 'asc' ? 1 : -1,
    };

    // ------------------------------------
    // FILTERS
    // ------------------------------------
    const filters: any = {
      vendorId: new Types.ObjectId(vendorId),
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
          { orderNumber: { $regex: s, $options: 'i' } },
        ];
      } else {
        filters.orderNumber = { $regex: s, $options: 'i' };
      }
    }

    if (upcoming === true) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of current day

      filters.status = { $in: ['paid', 'processing', 'confirmed'] };
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
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userData',
          pipeline: [
            {
              $project: {
                fullName: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                mobile: 1,
                addresses: 1,
              },
            },
          ],
        },
      },

      { $addFields: { userBase: { $arrayElemAt: ['$userData', 0] } } },

      {
        $addFields: {
          userDetails: {
            fullName: '$userBase.fullName',
            firstName: '$userBase.firstName',
            lastName: '$userBase.lastName',
            email: '$userBase.email',
            mobile: '$userBase.mobile',

            // ONLY MATCHED ADDRESS
            address: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$userBase.addresses',
                    as: 'addr',
                    cond: { $eq: ['$$addr._id', '$addressId'] },
                  },
                },
                0,
              ],
            },
          },
        },
      },

      { $project: { userBase: 0, userData: 0 } },

      // ------------------------------------
      // EVENT LOOKUP (BIRTHDAY + EXPERIENTIAL)
      // ------------------------------------
      {
        $lookup: {
          from: 'birthdayevents',
          localField: 'event.eventId',
          foreignField: '_id',
          as: 'birthdayEvent',
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
                subExperientialEventCategory: 1,
              },
            },
          ],
        },
      },

      {
        $lookup: {
          from: 'experientialevents',
          localField: 'event.eventId',
          foreignField: '_id',
          as: 'experientialEvent',
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
                subExperientialEventCategory: 1,
              },
            },
          ],
        },
      },

      // Pick correct model
      {
        $addFields: {
          eventData: {
            $cond: [
              { $eq: ['$event.eventCategory', 'BirthdayEvent'] },
              { $arrayElemAt: ['$birthdayEvent', 0] },
              { $arrayElemAt: ['$experientialEvent', 0] },
            ],
          },
        },
      },

      { $project: { birthdayEvent: 0, experientialEvent: 0 } },

      // ------------------------------------
      // FILTER ONLY SELECTED EVENT TIER
      // ------------------------------------
      {
        $addFields: {
          'eventData.tiers': {
            $filter: {
              input: '$eventData.tiers',
              as: 't',
              cond: { $eq: ['$$t._id', '$selectedTier.tierId'] },
            },
          },
        },
      },

      // ------------------------------------
      // CATEGORY LOOKUPS
      // ------------------------------------
      {
        $lookup: {
          from: 'dropdownoptions',
          let: {
            ids: {
              $cond: [
                { $isArray: '$eventData.experientialEventCategory' },
                '$eventData.experientialEventCategory',
                [
                  {
                    $ifNull: ['$eventData.experientialEventCategory', null],
                  },
                ],
              ],
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', '$$ids'],
                },
              },
            },
            { $project: { _id: 1, value: 1, label: 1, isActive: 1 } },
          ],
          as: 'eventData.experientialEventCategory',
        },
      },

      {
        $lookup: {
          from: 'subexperientialeventcategories',
          let: { ids: '$eventData.subExperientialEventCategory' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $project: { name: 1 } },
          ],
          as: 'eventData.subExperientialEventCategory',
        },
      },

      // ------------------------------------
      // VENDOR LOOKUP
      // ------------------------------------
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendorLookup',
          pipeline: [
            {
              $project: {
                businessName: 1,
                email: 1,
                phone: 1,
                city: 1,
              },
            },
          ],
        },
      },

      { $addFields: { vendorDetails: { $arrayElemAt: ['$vendorLookup', 0] } } },
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
            eventId: '$event.eventId',
            eventTitle: '$event.eventTitle',
            eventCategory: '$event.eventCategory',

            eventDetails: '$eventData',
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
          vendorDetails: 1,
        },
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
          metadata: [{ $count: 'total' }, { $addFields: { page, limit } }],
        },
      },

      {
        $addFields: {
          metadata: {
            $ifNull: [
              { $arrayElemAt: ['$metadata', 0] },
              { total: 0, page, limit },
            ],
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

  async getOrdersAddOnForVendor(vendorId: Types.ObjectId, query: any) {
    const {
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortDir = 'desc',
      status,
      upcoming,
      search,
      startDate,
      endDate,
    } = query;

    if (!Types.ObjectId.isValid(vendorId)) {
      throw new BadRequestException('Invalid vendorId');
    }

    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortDir === 'asc' ? 1 : -1,
    };

    // Base filter: only orders that contain addons for this vendor
    const filters: any = {
      'addons.addOnVendorId': new Types.ObjectId(vendorId),
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
          { orderNumber: { $regex: s, $options: 'i' } },
        ];
      } else {
        filters.orderNumber = { $regex: s, $options: 'i' };
      }
    }

    // Upcoming
    if (upcoming === true) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of current day

      filters.status = { $in: ['paid', 'processing', 'confirmed'] };
      filters.eventBookingDate = { $gte: today };
    }

    return await this.orderModel
      .aggregate([
        { $match: filters },

        // -------------------------
        // LOOKUP ALL ADDONS
        // -------------------------
        {
          $lookup: {
            from: 'addons',
            let: { ids: '$addons.addOnId' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$_id', '$$ids'] },
                },
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  tiers: 1,
                  addOnVendorId: 1,
                  banner: 1,
                },
              },
            ],
            as: 'addonsData',
          },
        },

        // ------------------------------------
        // USER LOOKUP → ONLY SELECTED ADDRESS
        // ------------------------------------
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userData',
            pipeline: [
              {
                $project: {
                  fullName: 1,
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                  mobile: 1,
                  addresses: 1,
                },
              },
            ],
          },
        },

        { $addFields: { userBase: { $arrayElemAt: ['$userData', 0] } } },

        {
          $addFields: {
            userDetails: {
              fullName: '$userBase.fullName',
              firstName: '$userBase.firstName',
              lastName: '$userBase.lastName',
              email: '$userBase.email',
              mobile: '$userBase.mobile',

              // ONLY MATCHED ADDRESS
              address: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$userBase.addresses',
                      as: 'addr',
                      cond: { $eq: ['$$addr._id', '$addressId'] },
                    },
                  },
                  0,
                ],
              },
            },
          },
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
                input: '$addons',
                as: 'a',
                in: {
                  $mergeObjects: [
                    '$$a',
                    {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$addonsData',
                            as: 'ad',
                            cond: {
                              $and: [
                                { $eq: ['$$ad._id', '$$a.addOnId'] },
                                { $eq: ['$$a.addOnVendorId', vendorId] },
                              ],
                            },
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

        // Remove non-vendor addons (null entries)
        {
          $addFields: {
            addons: {
              $filter: {
                input: '$addons',
                as: 'ad',
                cond: { $eq: ['$$ad.addOnVendorId', vendorId] },
              },
            },
          },
        },

        // -------------------------
        // FILTER TIER INSIDE ADDONS
        // -------------------------
        {
          $addFields: {
            addons: {
              $map: {
                input: '$addons',
                as: 'addon',
                in: {
                  $mergeObjects: [
                    '$$addon',
                    {
                      tiers: {
                        $filter: {
                          input: '$$addon.tiers',
                          as: 't',
                          cond: {
                            $eq: ['$$t._id', '$$addon.selectedTier.tierId'],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        // ------------------------------------
        // VENDOR LOOKUP
        // ------------------------------------
        {
          $lookup: {
            from: 'vendors',
            localField: 'vendorId',
            foreignField: '_id',
            as: 'vendorLookup',
            pipeline: [
              {
                $project: {
                  businessName: 1,
                  email: 1,
                  phone: 1,
                  city: 1,
                },
              },
            ],
          },
        },

        {
          $addFields: { vendorDetails: { $arrayElemAt: ['$vendorLookup', 0] } },
        },
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

            addressDetails: { city: '$addressDetails.city' },
          },
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
            metadata: [{ $count: 'total' }, { $addFields: { page, limit } }],
          },
        },
        {
          $addFields: {
            metadata: {
              $ifNull: [
                { $arrayElemAt: ['$metadata', 0] },
                { total: 0, page, limit },
              ],
            },
          },
        },
      ])
      .then((res) => ({
        results: res[0].data,
        totalResults: res[0].metadata.total,
        page: res[0].metadata.page,
        limit: res[0].metadata.limit,
        totalPages: Math.ceil(res[0].metadata.total / limit),
      }));
  }

  /**
   * Get booking count grouped by date for a vendor
   * Returns total bookings per date within the specified date range
   */
  async getVendorBookingCountByDate(
    vendorId: Types.ObjectId,
    query: { startDate?: string; endDate?: string },
  ) {
    const { startDate, endDate } = query;

    const filters: any = {
      status: { $in: ['paid', 'processing', 'confirmed', 'completed'] },
      $or: [{ vendorId }, { 'addons.addOnVendorId': vendorId }],
    };

    // Date range filter
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      filters.eventBookingDate = dateFilter;
    }

    const result = await this.orderModel.aggregate([
      { $match: filters },

      /**
       * Create number of bookings contributed by vendor in each order:
       * - event booking contributes 1 if vendorId matches
       * - addons contribute count of addons where addOnVendorId matches vendor
       */
      {
        $project: {
          eventBookingDate: 1,

          vendorBookingCount: {
            $add: [
              {
                $cond: [{ $eq: ['$vendorId', vendorId] }, 1, 0],
              },
              {
                $size: {
                  $filter: {
                    input: '$addons',
                    as: 'ad',
                    cond: { $eq: ['$$ad.addOnVendorId', vendorId] },
                  },
                },
              },
            ],
          },
        },
      },

      // Group by day
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$eventBookingDate' },
          },
          count: { $sum: '$vendorBookingCount' },
        },
      },

      { $sort: { _id: 1 } },

      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
        },
      },
    ]);

    const totalCount = result.reduce((sum, item) => sum + item.count, 0);

    return {
      vendorId,
      startDate: startDate || null,
      endDate: endDate || null,
      totalCount,
      bookingsByDate: result,
    };
  }
}
