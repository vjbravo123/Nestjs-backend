import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../order.schema';
import { UserOrdersQueryDto } from '../dto/user-orders-query.dto';

@Injectable()
export class OrderQueryService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async getOrdersForUser(userId: Types.ObjectId, query: UserOrdersQueryDto) {
    const {
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortDir = 'desc',
      orderStatus,
      upcoming,
      search,
      startDate,
      endDate,
    } = query;
    console.log('query for search', query);
    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortDir === 'asc' ? 1 : -1,
    };

    // ----------------------------
    // FILTERS
    // ----------------------------
    const filters: any = { userId };

    if (orderStatus) filters.orderStatus = orderStatus;

    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    if (search && search.trim()) {
      const s = search.trim();

      // =========================
      // 1️⃣ Exact ObjectId Search
      // =========================
      if (Types.ObjectId.isValid(s)) {
        const objectId = new Types.ObjectId(s);

        filters.$or = [
          { _id: objectId },
          { userId: objectId },
          { checkoutBatchId: objectId },
          { checkoutIntentId: objectId },
          { paymentId: objectId },
          { 'event.eventId': objectId },
        ];

        return; // stop here (fast indexed search)
      }

      // =========================
      // 2️⃣ Numeric Exact Search
      // =========================
      if (!isNaN(Number(s))) {
        const num = Number(s);

        filters.$or = [
          { subtotal: num },
          { totalAmount: num },
          { addonsAmount: num },
          { 'addressDetails.pincode': num },
          { 'addressDetails.mobile': num },
        ];

        return; // fast numeric index search
      }

      // =========================
      // 3️⃣ Enum Status Search (Exact Match)
      // =========================
      const lower = s.toLowerCase();

      if (
        ['confirmed', 'pending', 'cancelled', 'failed', 'completed'].includes(
          lower,
        )
      ) {
        filters.$or = [{ orderStatus: lower }, { paymentStatus: lower }];

        return;
      }

      // =========================
      // 4️⃣ Text Search (Indexed)
      // =========================
      filters.$text = { $search: s };
    }

    if (upcoming === true) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filters.status = { $in: ['paid', 'processing', 'confirmed'] };
      filters.eventBookingDate = { $gte: today };
    }
    console.log('final filters ', filters);
    const result = await this.orderModel.aggregate([
      { $match: filters },

      // -----------------------------------------
      // EVENT LOOKUP (birthdayevents + experientialevents + addons)
      // -----------------------------------------
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
          from: 'addons',
          localField: 'event.eventId',
          foreignField: '_id',
          as: 'addOnEvent', // ✅ rename (important)
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
                  case: { $eq: ['$event.eventCategory', 'BirthdayEvent'] },
                  then: { $arrayElemAt: ['$birthdayEvent', 0] },
                },
                {
                  case: { $eq: ['$event.eventCategory', 'ExperientialEvent'] },
                  then: { $arrayElemAt: ['$experientialEvent', 0] },
                },
                {
                  case: { $eq: ['$event.eventCategory', 'AddOn'] }, // ✅ NEW
                  then: { $arrayElemAt: ['$addOnEvent', 0] },
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
          'eventData.tiers': {
            $filter: {
              input: { $ifNull: ['$eventData.tiers', []] },
              as: 't',
              cond: { $eq: ['$$t._id', '$selectedTier.tierId'] },
            },
          },
        },
      },

      // -----------------------------------------
      // EVENT CATEGORY LOOKUPS
      // -----------------------------------------
      {
        $lookup: {
          from: 'dropdownoptions',
          let: {
            ids: {
              $cond: [
                { $isArray: '$eventData.experientialEventCategory' },
                '$eventData.experientialEventCategory',
                [{ $ifNull: ['$eventData.experientialEventCategory', null] }],
              ],
            },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $project: { _id: 1, value: 1, label: 1, isActive: 1 } },
          ],
          as: 'eventData.experientialEventCategory',
        },
      },
      {
        $lookup: {
          from: 'subexperientialeventcategories',
          let: {
            ids: { $ifNull: ['$eventData.subExperientialEventCategory', []] },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $project: { _id: 1, name: 1 } },
          ],
          as: 'eventData.subExperientialEventCategory',
        },
      },

      // -----------------------------------------
      // ADDONS LOOKUP (order addons list)
      // -----------------------------------------
      {
        $lookup: {
          from: 'addons',
          let: { ids: { $ifNull: ['$addons.addOnId', []] } },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
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
          as: 'addonsData',
        },
      },

      // MERGE ADDONS
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
                          cond: { $eq: ['$$ad._id', '$$a.addOnId'] },
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
              input: '$addons',
              as: 'addon',
              in: {
                $mergeObjects: [
                  '$$addon',
                  {
                    tiers: {
                      $filter: {
                        input: '$$addon.tiers',
                        as: 'tier',
                        cond: {
                          $eq: ['$$tier._id', '$$addon.selectedTier.tierId'],
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

      // -----------------------------------------
      // FINAL PROJECTION
      // -----------------------------------------
      {
        $project: {
          _id: 1,
          userId: 1,
          event: {
            eventId: '$event.eventId',
            eventTitle: '$event.eventTitle',
            eventCategory: '$event.eventCategory',
            eventDetails: {
              title: '$eventData.title',
              banner: '$eventData.banner',
              description: '$eventData.description',
              city: '$eventData.city',
              duration: '$eventData.duration',
              tiers: '$eventData.tiers',
              experientialEventCategory: '$eventData.experientialEventCategory',
              subExperientialEventCategory:
                '$eventData.subExperientialEventCategory',
            },
          },

          selectedTier: 1,
          addons: 1,

          addressDetails: { city: '$addressDetails.city' },
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

  async getUserOrderById(orderId: Types.ObjectId, userId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order ID format');
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
          from: 'addons',
          localField: 'event.eventId',
          foreignField: '_id',
          as: 'addOnEvent',
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
                  case: { $eq: ['$event.eventCategory', 'BirthdayEvent'] },
                  then: { $arrayElemAt: ['$birthdayEvent', 0] },
                },
                {
                  case: { $eq: ['$event.eventCategory', 'ExperientialEvent'] },
                  then: { $arrayElemAt: ['$experientialEvent', 0] },
                },
                {
                  case: { $eq: ['$event.eventCategory', 'AddOn'] },
                  then: { $arrayElemAt: ['$addOnEvent', 0] },
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
          'eventData.tiers': {
            $filter: {
              input: { $ifNull: ['$eventData.tiers', []] },
              as: 'tier',
              cond: { $eq: ['$$tier._id', '$selectedTier.tierId'] },
            },
          },
        },
      },

      // -------------------------------------------------
      // EXPERIENTIAL CATEGORY LOOKUP
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
          as: 'eventData.experientialEventCategory',
        },
      },

      // -------------------------------------------------
      // SUB-EXPERIENTIAL CATEGORY LOOKUP
      // -------------------------------------------------
      {
        $lookup: {
          from: 'subexperientialeventcategories',
          let: {
            ids: { $ifNull: ['$eventData.subExperientialEventCategory', []] },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $project: { _id: 1, name: 1, experientialEventCategoryId: 1 } },
          ],
          as: 'eventData.subExperientialEventCategory',
        },
      },

      // -------------------------------------------------
      // ADDONS LOOKUP + MERGE (ORDER ADDONS LIST)
      // -------------------------------------------------
      {
        $lookup: {
          from: 'addons',
          let: { ids: { $ifNull: ['$addons.addOnId', []] } },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
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
          as: 'addonsData',
        },
      },

      // MERGE ADDON DETAILS WITH SELECTED TIER
      {
        $addFields: {
          addons: {
            $map: {
              input: '$addons',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$addonsData',
                          as: 'a',
                          cond: { $eq: ['$$a._id', '$$item.addOnId'] },
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
              input: '$addons',
              as: 'addon',
              in: {
                $mergeObjects: [
                  '$$addon',
                  {
                    tiers: {
                      $filter: {
                        input: { $ifNull: ['$$addon.tiers', []] },
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

      { $project: { addonsData: 0 } },
    ]);

    if (!result.length) {
      throw new NotFoundException('Order not found or unauthorized');
    }

    return result[0];
  }

  async getOrderByIForUser(orderId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order ID format');
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

      {
        $addFields: {
          userBase: { $arrayElemAt: ['$userData', 0] },
        },
      },

      {
        $addFields: {
          userDetails: {
            fullName: '$userBase.fullName',
            firstName: '$userBase.firstName',
            lastName: '$userBase.lastName',
            email: '$userBase.email',
            mobile: '$userBase.mobile',

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

      // -------------------------------------------------
      // ⭐ VENDOR LOOKUP (MERGED)
      // -------------------------------------------------
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
                gstNo: 1,
                address: 1,
              },
            },
          ],
        },
      },

      {
        $addFields: {
          vendorDetails: { $arrayElemAt: ['$vendorLookup', 0] },
        },
      },

      { $project: { vendorLookup: 0 } },

      // -------------------------------------------------
      // EVENT LOOKUP — BirthdayEvent
      // -------------------------------------------------
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

      // Select correct model
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

      // -------------------------------------------------
      // FILTER SELECTED EVENT TIER
      // -------------------------------------------------
      {
        $addFields: {
          'eventData.tiers': {
            $filter: {
              input: '$eventData.tiers',
              as: 'tier',
              cond: { $eq: ['$$tier._id', '$selectedTier.tierId'] },
            },
          },
        },
      },

      // -------------------------------------------------
      // EXPERIENTIAL CATEGORY LOOKUP (SAFE)
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
          as: 'eventData.experientialEventCategory',
        },
      },

      // -------------------------------------------------
      // SUB-EXPERIENTIAL CATEGORY LOOKUP
      // -------------------------------------------------
      {
        $lookup: {
          from: 'subexperientialeventcategories',
          let: {
            ids: { $ifNull: ['$eventData.subExperientialEventCategory', []] },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $project: { _id: 1, name: 1, experientialEventCategoryId: 1 } },
          ],
          as: 'eventData.subExperientialEventCategory',
        },
      },

      // -------------------------------------------------
      // ADDONS LOOKUP & MERGE
      // -------------------------------------------------
      {
        $lookup: {
          from: 'addons',
          let: { ids: { $ifNull: ['$addons.addOnId', []] } },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            {
              $project: {
                _id: 1,
                name: 1,
                banner: 1,
                category: 1,
                description: 1,
                tiers: 1,
                cityOfOperation: 1,
              },
            },
          ],
          as: 'addonsData',
        },
      },

      {
        $addFields: {
          addons: {
            $map: {
              input: '$addons',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$addonsData',
                          as: 'a',
                          cond: { $eq: ['$$a._id', '$$item.addOnId'] },
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

      // FILTER SELECTED ADDON TIER
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

      { $project: { addonsData: 0 } },
    ]);

    if (!result.length) {
      throw new NotFoundException('Order not found');
    }

    return result[0];
  }

  async getUserOrdersByBatchId(
    batchId: Types.ObjectId,
    userId: Types.ObjectId,
  ) {
    const result = await this.orderModel.aggregate([
      // ---------------------------------
      // MATCH ORDER
      // ---------------------------------
      {
        $match: {
          checkoutBatchId: batchId,
          userId,
        },
      },

      // ---------------------------------
      // EVENT LOOKUPS (Both Collections)
      // ---------------------------------
      {
        $lookup: {
          from: 'birthdayevents',
          localField: 'event.eventId',
          foreignField: '_id',
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
          as: 'birthdayEvent',
        },
      },
      {
        $lookup: {
          from: 'experientialevents',
          localField: 'event.eventId',
          foreignField: '_id',
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
          as: 'experientialEvent',
        },
      },

      // ---------------------------------
      // CHOOSE CORRECT EVENT DATA
      // ---------------------------------
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

      // ---------------------------------
      // ⭐ FILTER SELECTED EVENT TIER ONLY
      // ---------------------------------
      {
        $addFields: {
          'eventData.tiers': {
            $filter: {
              input: '$eventData.tiers',
              as: 'tier',
              cond: { $eq: ['$$tier._id', '$selectedTier.tierId'] },
            },
          },
        },
      },

      // ---------------------------------
      // EXPERIENTIAL CATEGORY LOOKUP
      // ---------------------------------
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

      // ---------------------------------
      // SUB EXPERIENTIAL CATEGORY LOOKUP
      // ---------------------------------
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
          as: 'eventData.subExperientialEventCategory',
        },
      },

      // ---------------------------------
      // ADDONS LOOKUP WITH PROJECTION
      // ---------------------------------
      {
        $lookup: {
          from: 'addons',
          let: { ids: '$addons.addOnId' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
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
          as: 'addonsData',
        },
      },

      // ---------------------------------
      // MERGE PROJECTED ADDON FIELDS
      // ---------------------------------
      {
        $addFields: {
          addons: {
            $map: {
              input: '$addons',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$addonsData',
                          as: 'a',
                          cond: { $eq: ['$$a._id', '$$item.addOnId'] },
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

      // ---------------------------------
      // ⭐ FILTER SELECTED TIER INSIDE EACH ADDON
      // ---------------------------------
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
                        as: 'tier',
                        cond: {
                          $eq: ['$$tier._id', '$$addon.selectedTier.tierId'],
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
    ]);

    if (!result.length) {
      throw new NotFoundException('Order not found or unauthorized');
    }

    return result;
  }

  async getUserOrdersByCheckoutId(
    checkoutId: Types.ObjectId,
    userId: Types.ObjectId,
  ) {
    // console.log("👉 checkoutId,userID", checkoutId, userId);

    const result = await this.orderModel.aggregate([

      // ---------------------------------
      // MATCH ORDER
      // ---------------------------------
      {
        $match: {
          checkoutBatchId: checkoutId,
          userId,
        },
      },

      // ---------------------------------
      // EVENT LOOKUPS
      // ---------------------------------
      {
        $lookup: {
          from: 'birthdayevents',
          localField: 'event.eventId',
          foreignField: '_id',
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
          as: 'birthdayEvent',
        },
      },
      {
        $lookup: {
          from: 'experientialevents',
          localField: 'event.eventId',
          foreignField: '_id',
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
          as: 'experientialEvent',
        },
      },

      // ---------------------------------
      // SELECT EVENT DATA
      // ---------------------------------
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

      // ---------------------------------
      // FILTER EVENT TIER
      // ---------------------------------
      {
        $addFields: {
          'eventData.tiers': {
            $filter: {
              input: '$eventData.tiers',
              as: 'tier',
              cond: { $eq: ['$$tier._id', '$selectedTier.tierId'] },
            },
          },
        },
      },

      // ---------------------------------
      // EXPERIENTIAL CATEGORY
      // ---------------------------------
      {
        $lookup: {
          from: 'dropdownoptions',
          let: {
            ids: {
              $cond: [
                { $isArray: '$eventData.experientialEventCategory' },
                '$eventData.experientialEventCategory',
                [{ $ifNull: ['$eventData.experientialEventCategory', null] }],
              ],
            },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $project: { _id: 1, value: 1, label: 1, isActive: 1 } },
          ],
          as: 'eventData.experientialEventCategory',
        },
      },

      // ---------------------------------
      // SUB CATEGORY
      // ---------------------------------
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
          as: 'eventData.subExperientialEventCategory',
        },
      },

      // ---------------------------------
      // ADDONS LOOKUP
      // ---------------------------------
      {
        $lookup: {
          from: 'addons',
          let: { ids: '$addons.addOnId' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
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
          as: 'addonsData',
        },
      },

      // ---------------------------------
      // MERGE ADDONS
      // ---------------------------------
      {
        $addFields: {
          addons: {
            $map: {
              input: '$addons',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$addonsData',
                          as: 'a',
                          cond: { $eq: ['$$a._id', '$$item.addOnId'] },
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

      // ---------------------------------
      // FILTER ADDON TIERS
      // ---------------------------------
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
                        as: 'tier',
                        cond: {
                          $eq: ['$$tier._id', '$$addon.selectedTier.tierId'],
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

      // ---------------------------------
      // ✅ PAYMENT LOOKUP (LATEST)
      // ---------------------------------
      {
        $lookup: {
          from: 'payments',
          localField: 'checkoutIntentId',
          foreignField: 'checkoutIntentId',
          pipeline: [
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 1,
                merchantOrderId: 1,
                merchantTransactionId: 1,
                amount: 1,
                currency: 1,
                status: 1,
                gateway: 1,
                gatewayTransactionId: 1,
                paidAt: 1,
                createdAt: 1,
                updatedAt: 1,
                paymentMethod: 1,
                webhookProcessed: 1,
                isRefunded: 1,
                feeAmount: 1,

                "gatewayResponse.payload.merchantId": 1,
                "gatewayResponse.payload.orderId": 1,
                "gatewayResponse.payload.state": 1,
                "gatewayResponse.payload.amount": 1,
                "gatewayResponse.payload.currency": 1,
                "gatewayResponse.payload.expireAt": 1,
                "gatewayResponse.payload.paymentDetails": 1,
                "gatewayResponse.payload.splitInstruments": 1,
              },
            },
          ],
          as: 'paymentDetails',
        },
      },

      // ---------------------------------
      // FLATTEN PAYMENT
      // ---------------------------------
      {
        $addFields: {
          paymentDetails: {
            $cond: [
              { $gt: [{ $size: '$paymentDetails' }, 0] },
              { $arrayElemAt: ['$paymentDetails', 0] },
              null,
            ],
          },
        },
      },

      // ---------------------------------
      // PAYMENT RESULT
      // ---------------------------------
      {
        $addFields: {
          paymentResult: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$paymentDetails.status', 'success'] },
                  then: 'SUCCESS',
                },
                {
                  case: { $eq: ['$paymentDetails.status', 'failed'] },
                  then: 'FAILED',
                },
                {
                  case: { $eq: ['$paymentDetails.status', 'cancelled'] },
                  then: 'CANCELLED',
                },
                {
                  case: { $eq: ['$paymentDetails.status', 'pending'] },
                  then: 'PENDING',
                },
              ],
              default: 'PENDING',
            },
          },

          isPaymentFinal: {
            $in: ['$paymentDetails.status', ['success', 'failed', 'cancelled']],
          },
        },
      },
    ]);

    // console.log("👉 Aggregation result:", JSON.stringify(result, null, 2));

    if (!result.length) {
      throw new NotFoundException('Order not found or unauthorized');
    }

    return result;
  }
  
  async getUserOrderCount(userId: Types.ObjectId) {
    const today = new Date().toISOString().slice(0, 10);
    console.log('Today date is :', today);
    // Fastest way → run both queries in parallel
    const [totalOrders, upcomingBookings] = await Promise.all([
      this.orderModel.countDocuments({ userId }),

      this.orderModel.countDocuments({
        userId,
        status: { $in: ['paid', 'processing', 'confirmed'] },
        eventBookingDate: { $gte: today }, // FIXED: compare eventDate (string) not eventBookingDate
      }),
    ]);

    return {
      userId,
      totalOrders,
      upcomingBookings,
    };
  }
}
