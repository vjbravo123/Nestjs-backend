import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../order.schema';
import { AdminOrdersQueryDto } from '../dto/admin-orders-query.dto';
import { VendorOrdersQueryDto } from '../dto/vendor-orders-query.dto';
import { AddOn } from '../../addOn/addon.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import logger from '../../../common/utils/logger';

@Injectable()
export class AdminOrderService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(AddOn.name) private addOnModel: Model<AddOn>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getOrderByIdForAdmin(orderId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const pipeline: any[] = [
      // MATCH ORDER
      { $match: { _id: orderId } },

      // USER LOOKUP
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
                email: 1,
                mobile: 1,
              },
            },
          ],
        },
      },
      { $set: { user: { $first: '$user' } } },

      // MAIN VENDOR DETAILS
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendorDetails',
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
      { $set: { vendorDetails: { $first: '$vendorDetails' } } },

      // EVENT LOOKUPS
      {
        $lookup: {
          from: 'birthdayevents',
          localField: 'event.eventId',
          foreignField: '_id',
          as: 'birthdayEvent',
        },
      },
      {
        $lookup: {
          from: 'experientialevents',
          localField: 'event.eventId',
          foreignField: '_id',
          as: 'experientialEvent',
        },
      },

      // select event type
      {
        $set: {
          eventData: {
            $cond: [
              { $eq: ['$event.eventCategory', 'BirthdayEvent'] },
              { $first: '$birthdayEvent' },
              { $first: '$experientialEvent' },
            ],
          },
        },
      },

      // EXPERIENTIAL CATEGORY LOOKUP
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
                $expr: { $in: ['$_id', '$$ids'] },
              },
            },
            { $project: { _id: 1, value: 1, label: 1, isActive: 1 } },
          ],
          as: 'eventData.experientialEventCategory',
        },
      },

      // SUB EXPERIENTIAL CATEGORY LOOKUP
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
                firstName: 1,
                lastName: 1,
                mobile: 1,

                city: 1,
              },
            },
          ],
        },
      },

      { $addFields: { vendorDetails: { $arrayElemAt: ['$vendorLookup', 0] } } },
      { $project: { vendorLookup: 0 } },
      // filter event tier
      {
        $set: {
          'eventData.tiers': {
            $filter: {
              input: '$eventData.tiers',
              cond: { $eq: ['$$this._id', '$selectedTier.tierId'] },
            },
          },
        },
      },

      // event discount
      {
        $set: {
          'eventData.discount': {
            $cond: [
              { $eq: ['$event.eventCategory', 'BirthdayEvent'] },
              { $first: '$birthdayEvent.discount' },
              { $first: '$experientialEvent.discount' },
            ],
          },
        },
      },

      // LOOKUP ADDONS
      {
        $lookup: {
          from: 'addons',
          let: { ids: '$addons.addOnId' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $project: { _id: 1, name: 1, banner: 1, addOnVendorId: 1 } },
          ],
          as: 'addonsData',
        },
      },

      // LOOKUP ADDON VENDORS
      {
        $lookup: {
          from: 'vendors',
          let: { vendorIds: '$addons.addOnVendorId' },
          pipeline: [
            {
              $match: { $expr: { $in: ['$_id', '$$vendorIds'] } },
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
                address: 1,
              },
            },
          ],
          as: 'addonVendorLookup',
        },
      },

      // MERGE ADDON DATA
      {
        $set: {
          addons: {
            $map: {
              input: '$addons',
              as: 'a',
              in: {
                $mergeObjects: [
                  '$$a',

                  {
                    $first: {
                      $filter: {
                        input: '$addonsData',
                        cond: { $eq: ['$$this._id', '$$a.addOnId'] },
                      },
                    },
                  },

                  {
                    addonVendorData: {
                      $first: {
                        $filter: {
                          input: '$addonVendorLookup',
                          cond: { $eq: ['$$this._id', '$$a.addOnVendorId'] },
                        },
                      },
                    },
                  },

                  {
                    tiers: {
                      $filter: {
                        input: {
                          $getField: {
                            field: 'tiers',
                            input: {
                              $first: {
                                $filter: {
                                  input: '$addonsData',
                                  cond: { $eq: ['$$this._id', '$$a.addOnId'] },
                                },
                              },
                            },
                          },
                        },
                        cond: {
                          $eq: ['$$this._id', '$$a.selectedTier.tierId'],
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
            ageGroup: 1,
          },
        },
      },

      // CLEANUP
      {
        $project: {
          addonsData: 0,
          addonVendorLookup: 0,
          birthdayEvent: 0,
          experientialEvent: 0,
        },
      },
    ];

    const result = await this.orderModel.aggregate(pipeline);
    if (!result.length) throw new NotFoundException('Order not found');
    return result[0];
  }

  async getOrdersForAdmin(query: AdminOrdersQueryDto) {
    const {
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortDir = 'desc',
      status,
      userId,
      search,
      startDate,
      endDate,
    } = query;

    const skip = (page - 1) * limit;

    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortDir === 'asc' ? 1 : -1,
    };

    // ---------------------------
    // BUILD FILTERS
    // ---------------------------
    const filters: any = {};

    if (status) filters.status = status;

    if (userId) {
      if (!Types.ObjectId.isValid(userId))
        throw new BadRequestException('Invalid userId');

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
        filters.orderNumber = { $regex: s, $options: 'i' };
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

            // only selected Address
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

      // ------------------------
      // VENDOR LOOKUP
      // ------------------------
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendorData',
          pipeline: [
            {
              $project: {
                businessName: 1,
                email: 1,
                mobile: 1,
                city: 1,
                address: 1,
                gstNo: 1,
              },
            },
          ],
        },
      },

      {
        $addFields: {
          vendorDetails: { $arrayElemAt: ['$vendorData', 0] },
        },
      },

      { $project: { vendorData: 0 } },

      // ------------------------
      // EVENT LOOKUPS
      // ------------------------
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

      // only selected tier
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

      // categories
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
            { $project: { _id: 1, value: 1, label: 1 } },
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
            { $project: { _id: 1, name: 1, experientialEventCategoryId: 1 } },
          ],
          as: 'eventData.subExperientialEventCategory',
        },
      },

      // ------------------------
      // ADDONS LOOKUP
      // ------------------------
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

      // only selected addon tier
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

      // ------------------------
      // FACET PAGINATION
      // ------------------------
      {
        $facet: {
          metadata: [{ $count: 'total' }, { $addFields: { page, limit } }],
          data: [
            { $sort: sort as any },
            { $skip: skip },
            { $limit: limit },
            { $project: { paymentDetails: 0, __v: 0 } },
          ],
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
      data: result[0].data,
      totalResults: result[0].metadata.total,
      page: result[0].metadata.page,
      limit: result[0].metadata.limit,
      totalPages: Math.ceil(result[0].metadata.total / limit),
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
  async updateOrderByAdmin(orderId: Types.ObjectId, updateDto: any) {
    console.log('================ ADMIN UPDATE ORDER ================');
    console.log('➡️ Order ID:', orderId);

    // Check if order exists and populate user for email
    const order = await this.orderModel
      .findById(orderId)
      .populate('userId', 'email firstName lastName mobile');
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    console.log('✅ Order found:', {
      orderNumber: order.orderNumber,
      currentStatus: order.orderStatus,
    });

    // Store old values for comparison
    const oldEventDate = order.eventDate;
    const oldEventTime = order.eventTime;
    const oldDateTime =
      oldEventDate && oldEventTime ? `${oldEventDate} ${oldEventTime}` : '';
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

        updateData.eventBookingDate = new Date(
          `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000Z`,
        );
        console.log(
          '📝 Updating eventBookingDate:',
          updateData.eventBookingDate,
        );
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
    const finalAddons =
      updateData.addons !== undefined ? updateData.addons : order.addons;

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
      console.log(
        '💰 Calculated addonsAmount from addons:',
        updateData.addonsAmount,
        `(${finalAddons.length} addons)`,
      );
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
    console.log(
      '💰 Calculated subtotal:',
      updateData.subtotal,
      `(${updateData.baseAmount} + ${updateData.addonsAmount})`,
    );

    // Calculate totalAmount = subtotal - discount
    updateData.totalAmount = updateData.subtotal - updateData.discount;
    console.log(
      '💰 Calculated totalAmount:',
      updateData.totalAmount,
      `(${updateData.subtotal} - ${updateData.discount})`,
    );

    // Note: We ignore any baseAmount, addonsAmount, subtotal, or totalAmount from frontend
    // These are always calculated server-side for security and consistency

    /* -------------------------------------------------
     * 8️⃣ Perform the update
     * ------------------------------------------------- */
    console.log('💾 Updating order in database...');

    const updatedOrder = await this.orderModel
      .findByIdAndUpdate(
        orderId,
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .populate('userId', 'email firstName lastName mobile');

    if (!updatedOrder) {
      throw new NotFoundException(`Failed to update order with ID ${orderId}`);
    }

    console.log('✅ Order updated successfully');

    /* -------------------------------------------------
     * 9️⃣ Emit booking.updated event
     * ------------------------------------------------- */
    const user = updatedOrder.userId as any;
    const userEmail = user?.email || '';
    const userMobile = user?.mobile;

    const newEventDate = updatedOrder.eventDate || oldEventDate;
    const newEventTime = updatedOrder.eventTime || oldEventTime;
    const newDateTime =
      newEventDate && newEventTime ? `${newEventDate} ${newEventTime}` : '';
    const newVenue = updatedOrder.addressDetails?.address || oldVenue;
    const newAmount = updatedOrder.totalAmount;

    logger.info(
      `📩 [Order] Emitting booking.updated event for order ${updatedOrder.orderNumber}`,
    );
    console.log('📧 Emitting booking.updated event');

    this.eventEmitter.emit('booking.updated', {
      bookingId: updatedOrder.orderNumber,
      eventName: updatedOrder.event?.eventTitle || 'N/A',
      eventDateTime: newDateTime,
      venue: newVenue || 'N/A',
      partnerName:
        user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : 'N/A',
      bookingStatus: updatedOrder.orderStatus,
      oldDateTime: oldDateTime,
      newDateTime: newDateTime,
      oldVenue: oldVenue,
      newVenue: newVenue,
      oldAmount: oldAmount,
      newAmount: newAmount,
      email: userEmail,
      mobile: userMobile,
      userName: user?.firstName,
    });

    logger.info(
      `✅ [Order] booking.updated event emitted for order ${updatedOrder.orderNumber}`,
    );
    console.log('✅ Event emitted successfully');
    console.log('================ ADMIN UPDATE ORDER END ================');

    return updatedOrder;
  }

  async getOrderByQuery(query: VendorOrdersQueryDto) {
    const { vendorIds, status, date, city } = query;

    if (!vendorIds || vendorIds.length === 0) {
      return { data: [] };
    }

    if (!date) {
      return { data: [], message: 'date is required' };
    }

    const vendorObjectIds = vendorIds.map((id) => new Types.ObjectId(id));
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(queryDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // 1. Get all addons created by these vendors
    const addons = await this.addOnModel
      .find({
        createdBy: { $in: vendorObjectIds },
        isActive: true,
      })
      .lean();

    if (addons.length === 0) {
      return { data: [] };
    }

    const addonIds = addons.map((a: any) => a._id);

    // 2. Build order filters for the specific date
    const orderFilters: any = {
      'addons.addOnId': { $in: addonIds },
      status: { $in: ['paid', 'processing', 'confirmed'] },
      eventBookingDate: {
        $gte: queryDate,
        $lt: nextDay,
      },
    };

    if (status) {
      orderFilters.status = status;
    }

    if (city) {
      orderFilters['addressDetails.city'] = { $regex: city, $options: 'i' };
    }

    // 3. Aggregate booked slots per addon per slot type for the given date
    const bookedSlots = await this.orderModel.aggregate([
      { $match: orderFilters },
      { $unwind: '$addons' },
      { $match: { 'addons.addOnId': { $in: addonIds } } },
      {
        $unwind: {
          path: '$addons.selectedTier.slots',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            addOnId: '$addons.addOnId',
            slotType: '$addons.selectedTier.slots.slotType',
          },
          bookedQuantity: {
            $sum: { $ifNull: ['$addons.selectedTier.slots.quantity', 1] },
          },
        },
      },
      {
        $group: {
          _id: '$_id.addOnId',
          slots: {
            $push: {
              slotType: '$_id.slotType',
              bookedQuantity: '$bookedQuantity',
            },
          },
        },
      },
    ]);

    // 4. Build a map of booked slots: addOnId -> slotType -> bookedQuantity
    const bookedMap = new Map<string, Map<string, number>>();
    for (const item of bookedSlots) {
      const addOnId = item._id.toString();
      const slotMap = new Map<string, number>();
      for (const slot of item.slots) {
        if (slot.slotType) {
          slotMap.set(slot.slotType, slot.bookedQuantity);
        }
      }
      bookedMap.set(addOnId, slotMap);
    }

    // 5. Build response with availability per addon
    const result = addons.map((addon: any) => {
      const addOnId = addon._id.toString();
      const vendorId = addon.createdBy?.toString();

      // Get max slots for the specified city (or first city if not specified)
      const cityData = (addon.cityOfOperation || []).find((c: any) =>
        city ? c.name?.toLowerCase() === city.toLowerCase() : true,
      );

      // Get booked data for this addon
      const addonBookedMap =
        bookedMap.get(addOnId) || new Map<string, number>();

      // Build slots availability - show all slot types from cityOfOperation
      const slotsAvailability: any[] = [];
      if (cityData?.slots) {
        for (const slot of cityData.slots) {
          const maxCapacity = slot.maxSlotBookingsPerDay || 0;
          const booked = addonBookedMap.get(slot.slotType) || 0;
          slotsAvailability.push({
            slotType: slot.slotType,
            maxCapacity,
            booked,
            available: Math.max(0, maxCapacity - booked),
          });
        }
      }

      return {
        addOnId: addon._id,
        addOnName: addon.name,
        vendorId,
        city: cityData?.name || null,
        date,
        slots: slotsAvailability,
      };
    });

    return { data: result };
  }
}
