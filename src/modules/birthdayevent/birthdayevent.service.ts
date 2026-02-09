import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BirthdayEvent, BirthdayEventDocument } from './birthdayevent.schema';
import { Order } from '../order/order.schema';
import { AddOn } from '../addOn/addon.schema';
import { CreateBirthdayEventDto } from './dto/create-birthdayevent.dto';
import { UpdateBirthdayEventDto } from './dto/update-birthdayevent.dto';
import { deleteImageFromS3 } from '../../common/utils/s3-upload.util'

@Injectable()
export class BirthdayEventService {

  private readonly MAX_SHOWCASE_LIMIT = 9;
  constructor(
    @InjectModel(BirthdayEvent.name)
    private readonly birthdayEventModel: Model<BirthdayEventDocument>,
    @InjectModel(AddOn.name)
    private readonly addOnModel: Model<AddOn>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<Order>,
  ) { }

  async create(dto: CreateBirthdayEventDto, admin: any) {
    // -------------------------------------------------------
    // 1️⃣ Validate Showcase Event Limit (Max: 9)
    // -------------------------------------------------------
    if (dto.isShowcaseEvent) {
      const showcaseCount = await this.birthdayEventModel.countDocuments({
        isShowcaseEvent: true,
      });

      if (showcaseCount >= 9) {
        throw new BadRequestException(
          'Cannot create more than 9 showcase events'
        );
      }
    }

    // -------------------------------------------------------
    // 2️⃣ Pre-process DTO (Convert addOn strings → ObjectIds)
    // -------------------------------------------------------
    const addOns = Array.isArray(dto.addOns)
      ? dto.addOns.map((id) => new Types.ObjectId(id))
      : [];

    // -------------------------------------------------------
    // 3️⃣ Create Event
    // -------------------------------------------------------
    return this.birthdayEventModel.create({
      ...dto,
      addOns,
      createdBy: admin?._id, // optional: audit trail
    });
  }


  async findAll(options: any = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy, // now supports both object & string
      eventDate,
      city,
      ...filter
    } = options;

    console.log("filter is  is a ", filter);

    // Base match filter
    const match: any = { active: true };

    if (filter.ageGroup) match.ageGroup = filter.ageGroup;
    if (filter.title) match.title = filter.title;
    if (filter.totalBookings) match.totalBookings = filter.totalBookings;
    if (filter.isShowcaseEvent == 'true') match.isShowcaseEvent = true;
    if (filter.priceRange) {
      const [minStr, maxStr] = filter.priceRange.split('-');

      const min = minStr ? Number(minStr) : undefined;
      const max = maxStr ? Number(maxStr) : undefined;

      // Use first tier price ONLY
      match['tiers.0.price'] = {};

      if (min !== undefined && !Number.isNaN(min)) {
        match['tiers.0.price'].$gte = min;
      }

      if (max !== undefined && !Number.isNaN(max)) {
        match['tiers.0.price'].$lte = max;
      }

      // Cleanup: avoid empty object
      if (Object.keys(match['tiers.0.price']).length === 0) {
        delete match['tiers.0.price'];
      }
    }


    if (city) {
      match["city.name"] = { $in: Array.isArray(city) ? city : [city] };
    }

    if (filter.subCategory) match.subCategory = filter.subCategory;

    // Convert eventDate into day range (if provided)
    let startOfDay: Date | null = null;
    let endOfDay: Date | null = null;
    if (eventDate) {
      startOfDay = new Date(eventDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(eventDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
    }

    // --- Base pipeline ---
    const pipeline: any[] = [{ $match: match }];

    // --- Add lookup only if eventDate is passed ---
    if (eventDate) {
      pipeline.push(
        {
          $lookup: {
            from: "orders",
            let: { eventId: "$_id", cityName: "$city.name" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$event._id", "$$eventId"] },
                      { $gte: ["$eventBookingDate", startOfDay] },
                      { $lte: ["$eventBookingDate", endOfDay] },
                      city
                        ? {
                          $eq: [
                            "$eventAddress.city",
                            Array.isArray(city) ? city[0] : city,
                          ],
                        }
                        : {},
                    ].filter(Boolean),
                  },
                },
              },
            ],
            as: "ordersOnDate",
          },
        },
        { $addFields: { bookingCount: { $size: "$ordersOnDate" } } },
        {
          $match: {
            $expr: {
              $lt: [
                "$bookingCount",
                { $ifNull: [{ $max: "$city.maxBookingsPerDay" }, Infinity] },
              ],
            },
          },
        }
      );
    }

    // Projection
    pipeline.push({
      $project: {
        title: 1,
        banner: 1,
        ageGroup: 1,
        duration: 1,
        city: 1,
        tiers: 1,
        tags: 1,
        discount: 1,
        exclusion: 1,
        isShowcaseEvent: 1,
        delight: 1,
        description: 1,
        totalBookings: 1,
        subCategory: 1,
        createdAt: 1,
        ...(eventDate && { bookingCount: 1 }),
      },
    });

    // ✅ Sort handler
    let sortStage: any = { createdAt: -1 }; // default

    if (sortBy) {
      if (typeof sortBy === "string") {
        sortStage = {};
        sortBy.split(",").forEach((s: string) => {
          if (s.includes(":desc")) {
            sortStage[s.replace(":desc", "").replace("[0]", ".0").trim()] = -1;
          } else {
            sortStage[s.replace(":asc", "").replace("[0]", ".0").trim()] = 1;
          }
        });
      } else if (typeof sortBy === "object") {
        // normalize keys like tiers[0].price -> tiers.0.price
        sortStage = {};
        Object.entries(sortBy).forEach(([k, v]) => {
          sortStage[k.replace("[0]", ".0")] = v;
        });
      }
    }

    pipeline.push({ $sort: sortStage });
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: Number(limit) });

    // console.log("match", match);
    // console.log("sortStage", sortStage);
    console.log("match data", match);
    const events = await this.birthdayEventModel.aggregate(pipeline);

    // --- Total count for pagination ---
    let total = 0;

    if (eventDate) {
      const totalCountAgg = await this.birthdayEventModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: "orders",
            let: { eventId: "$_id", cityName: "$city.name" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$event._id", "$$eventId"] },
                      { $gte: ["$eventBookingDate", startOfDay] },
                      { $lte: ["$eventBookingDate", endOfDay] },
                      city
                        ? {
                          $eq: [
                            "$eventAddress.city",
                            Array.isArray(city) ? city[0] : city,
                          ],
                        }
                        : {},
                    ].filter(Boolean),
                  },
                },
              },
            ],
            as: "ordersOnDate",
          },
        },
        { $addFields: { bookingCount: { $size: "$ordersOnDate" } } },
        {
          $match: {
            $expr: {
              $lt: [
                "$bookingCount",
                { $ifNull: [{ $max: "$city.maxBookingsPerDay" }, Infinity] },
              ],
            },
          },
        },
        { $count: "total" },
      ]);

      total = totalCountAgg.length ? totalCountAgg[0].total : 0;
    } else {
      total = await this.birthdayEventModel.countDocuments(match);
    }

    return {
      results: events,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      totalResults: total,
    };
  }
  async findAllForAdmin(options: any = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy,
      select,
      eventDate,
      city,
      ...filter
    } = options;
    console.log("filter inside the get birthday ", options)
    // Base match filter
    const match: any = {};

    if (filter.ageGroup) match.ageGroup = filter.ageGroup;
    if (filter.title) match.title = filter.title;
    if (filter.active) match.active = filter.active
    if (filter.totalBookings) match.totalBookings = filter.totalBookings;
    if (filter.isShowcaseEvent == 'true') match.isShowcaseEvent = true;

    if (filter.priceRange) {
      const [minStr, maxStr] = filter.priceRange.split("-");
      const min = minStr ? Number(minStr) : undefined;
      const max = maxStr ? Number(maxStr) : undefined;

      match["tiers.price"] = {};
      if (min !== undefined && !isNaN(min)) match["tiers.price"].$gte = min;
      if (max !== undefined && !isNaN(max)) match["tiers.price"].$lte = max;
    }

    if (city) {
      ``
      match["city.name"] = { $in: Array.isArray(city) ? city : [city] };
    }

    if (filter.subCategory) match.subCategory = filter.subCategory;

    // Convert eventDate into day range (if provided)
    let startOfDay: Date | null = null;
    let endOfDay: Date | null = null;
    if (eventDate) {
      startOfDay = new Date(eventDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(eventDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
    }

    // --- Base pipeline ---
    const pipeline: any[] = [{ $match: match }];

    // --- Add lookup only if eventDate is passed ---
    if (eventDate) {
      pipeline.push(
        {
          $lookup: {
            from: "orders",
            let: { eventId: "$_id", cityName: "$city.name" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$event._id", "$$eventId"] },
                      { $gte: ["$eventBookingDate", startOfDay] },
                      { $lte: ["$eventBookingDate", endOfDay] },
                      city
                        ? {
                          $eq: [
                            "$eventAddress.city",
                            Array.isArray(city) ? city[0] : city,
                          ],
                        }
                        : {},
                    ].filter(Boolean),
                  },
                },
              },
            ],
            as: "ordersOnDate",
          },
        },
        { $addFields: { bookingCount: { $size: "$ordersOnDate" } } },
        {
          $match: {
            $expr: {
              $lt: [
                "$bookingCount",
                { $ifNull: [{ $max: "$city.maxBookingsPerDay" }, Infinity] },
              ],
            },
          },
        }
      );
    }

    // --- Sort handler ---
    let sortStage: any = { createdAt: -1 }; // default

    if (sortBy) {
      if (typeof sortBy === "string") {
        sortStage = {};
        sortBy.split(",").forEach((s: string) => {
          if (s.includes(":desc")) {
            sortStage[s.replace(":desc", "").replace("[0]", ".0").trim()] = -1;
          } else {
            sortStage[s.replace(":asc", "").replace("[0]", ".0").trim()] = 1;
          }
        });
      } else if (typeof sortBy === "object") {
        sortStage = {};
        Object.entries(sortBy).forEach(([k, v]) => {
          sortStage[k.replace("[0]", ".0")] = v;
        });
      }
    }

    pipeline.push({ $sort: sortStage });
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: Number(limit) });

    if (select) {
      const project: any = {};

      select
        .split(',')
        .map((f: string) => f.trim())
        .forEach((field: string) => {
          project[field] = 1;
        });

      // Always keep _id unless explicitly removed
      if (!project._id) project._id = 1;

      pipeline.push({ $project: project });
    }

    const events = await this.birthdayEventModel.aggregate(pipeline);

    // --- Total count for pagination ---
    let total = 0;

    if (eventDate) {
      const totalCountAgg = await this.birthdayEventModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: "orders",
            let: { eventId: "$_id", cityName: "$city.name" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$event._id", "$$eventId"] },
                      { $gte: ["$eventBookingDate", startOfDay] },
                      { $lte: ["$eventBookingDate", endOfDay] },
                      city
                        ? {
                          $eq: [
                            "$eventAddress.city",
                            Array.isArray(city) ? city[0] : city,
                          ],
                        }
                        : {},
                    ].filter(Boolean),
                  },
                },
              },
            ],
            as: "ordersOnDate",
          },
        },
        { $addFields: { bookingCount: { $size: "$ordersOnDate" } } },
        {
          $match: {
            $expr: {
              $lt: [
                "$bookingCount",
                { $ifNull: [{ $max: "$city.maxBookingsPerDay" }, Infinity] },
              ],
            },
          },
        },
        { $count: "total" },
      ]);

      total = totalCountAgg.length ? totalCountAgg[0].total : 0;
    } else {
      total = await this.birthdayEventModel.countDocuments(match);
    }

    return {
      results: events,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      totalResults: total,
    };
  }

  async findAllWithSelected() {
    const events = await this.birthdayEventModel
      .find()
      .select('title active')
      .sort({ title: 1 })
      .exec();

    return events;
  }

  async updateActive(eventId: string) {
    const event = await this.birthdayEventModel.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }
    event.active = !event.active;
    await event.save();
    return event;
  }
  async updateShowCase(eventId: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException('Invalid Event ID');
    }

    // Fetch event with only needed field
    const event = await this.birthdayEventModel
      .findById(eventId)
      .select('isShowcaseEvent');

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const willEnableShowcase = !event.isShowcaseEvent;

    // Validate only when enabling showcase mode
    if (willEnableShowcase) {
      const currentCount = await this.birthdayEventModel.countDocuments({
        isShowcaseEvent: true,
        _id: { $ne: eventId }, // prevents self-count issue
      });

      if (currentCount >= this.MAX_SHOWCASE_LIMIT) {
        throw new BadRequestException(
          `Showcase limit reached — Only ${this.MAX_SHOWCASE_LIMIT} items can be showcased.`
        );
      }
    }

    // Toggle and save
    event.isShowcaseEvent = willEnableShowcase;
    await event.save();

    return {
      success: true,
      message: willEnableShowcase
        ? 'Event added to showcase.'
        : 'Event removed from showcase.',
      data: {
        id: eventId,
        isShowcaseEvent: event.isShowcaseEvent,
      },
    };
  }

  async findById(eventId: string) {
    return this.birthdayEventModel.findById(eventId)
    // .populate({
    //   path: 'addOns',
    //   select: 'name description price duration maxQuantity isActive banner popular category'
    // });
  }
  async update(
    eventId: string,
    dto: UpdateBirthdayEventDto
  ): Promise<BirthdayEventDocument> {

    // 1️⃣ Fetch existing event
    const event = await this.birthdayEventModel.findById(eventId);
    if (!event) throw new NotFoundException('Birthday event not found');

    // 2️⃣ Build updateData (skip undefined)
    const updatableFields = [
      'title',
      'ageGroup',
      'duration',
      'city',
      'description',
      'subCategory',
      'coreActivity',
      'tiers',
      'tags',
      'addOns',
      'exclusion',
      'delight',
      'existingBanners',
      'addBanner',
      'banner',
      'active'
    ];

    const updateData: Partial<BirthdayEventDocument> = Object.fromEntries(
      Object.entries(dto).filter(([key, val]) =>
        updatableFields.includes(key) && val !== undefined
      )
    );

    console.log("dto of bd", dto);

    // 3️⃣ Discount Logic (THE FIX)
    if ("discount" in dto) {
      const d = dto.discount;

      if (d === null || d === undefined) {
        updateData.discount = null; // remove
      } else if (typeof d === "number") {
        updateData.discount = d; // update
      }
    }


    // If dto.discount === undefined → don't touch discount at all

    // 4️⃣ Convert addOns to ObjectIds
    if (Array.isArray(dto.addOns)) {
      updateData.addOns = dto.addOns.map(id => new Types.ObjectId(id));
    }

    // 5️⃣ Banner Management
    const existingBanners = event.banner ?? [];
    const keptBanners = dto.existingBanners ?? [];
    const newBanners = dto.addBanner ?? [];
    const finalBanners = [...keptBanners, ...newBanners];

    updateData.banner = finalBanners;

    const deletedBanners = existingBanners.filter(
      (oldBanner) => !finalBanners.includes(oldBanner)
    );

    if (deletedBanners.length > 0) {
      await Promise.allSettled(
        deletedBanners.map(async (bannerUrl) => {
          const key = extractS3KeyFromUrl(bannerUrl);
          if (!key) return;
          try {
            await deleteImageFromS3({ key });
            console.log(`🧹 Deleted banner from S3: ${key}`);
          } catch (err) {
            console.error(`❌ Failed to delete S3 image: ${bannerUrl}`, err.message);
          }
        })
      );
    }

    // 6️⃣ Kids category validation
    const effectiveAgeGroup = updateData.ageGroup ?? event.ageGroup;
    const effectiveSubCategory = updateData.subCategory ?? event.subCategory;

    if (effectiveAgeGroup === 'kids' && !effectiveSubCategory) {
      throw new BadRequestException('Sub category is required for kids age group');
    }

    console.log("birthday data BEFORE update ", updateData);

    // 7️⃣ Save updated event
    const updatedEvent = await this.birthdayEventModel.findByIdAndUpdate(
      eventId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedEvent) {
      throw new NotFoundException("Failed to update birthday event");
    }

    return updatedEvent;
  }

  /**
   * Extracts the S3 object key from its public URL.
   * Example:
   * https://bucket.s3.region.amazonaws.com/folder/file.jpg
   * → returns: folder/file.jpg
   */







  async removeImage(eventId: string, imageUrl: string) {
    const event = await this.birthdayEventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException('Birthday event not found');
    }
    // Remove only the specified image
    event.banner = (event.banner || []).filter(img => img !== imageUrl);
    await event.save();
    return event;
  }



  async deleteEvent(eventId: string) {
    // Delete the event and get the deleted document
    const event = await this.birthdayEventModel.findByIdAndDelete(eventId);
    if (!event) throw new NotFoundException('Birthday event not found');

    // Check if event has banners
    if (Array.isArray(event.banner) && event.banner.length > 0) {
      // Check if event is booked (support both string & ObjectId)
      const isBooked = await this.orderModel.exists({
        $or: [
          { "event._id": new Types.ObjectId(eventId) },
          { "event._id": eventId },
        ],
      });

      if (!isBooked) {
        console.log("Deleting event banners from S3...");

        await Promise.all(
          event.banner.map(async (bannerUrl) => {
            const key = extractS3KeyFromUrl(bannerUrl);
            if (!key) return;
            try {
              await deleteImageFromS3({ key });
              console.log(`Deleted S3 image: ${key}`);
            } catch (err) {
              console.error(`Failed to delete S3 image: ${bannerUrl}`, err.message);
            }
          })
        );
      } else {
        console.log("Event has existing bookings, skipping S3 image deletion.");
      }
    }

    return { message: 'Birthday event deleted successfully' };
  }





}


function extractS3KeyFromUrl(url: string): string | null {
  try {
    const match = url.match(/amazonaws\.com\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}