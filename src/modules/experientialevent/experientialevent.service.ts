import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AdminQueryExperientialEventDto } from './dto/admin-query-experiential-event.dto';
import { instanceToPlain } from 'class-transformer';
import { isEqual, omit } from 'lodash';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import {
  ExperientialEvent,
  ExperientialEventDocument,
} from './experientialevent.schema';
import { EventChangeHistoryService } from '../event-change-history/event-change-history.service';
import { VendorAvailabilityService } from '../vendoravailability/vendor-availability.service';
import {
  UpdateExperientialEventDto,
  UpdateExperientialEventByAdminDto,
} from './dto/update-experientialevent.dto';
import { UpdateExperientialEventByVendorDto } from './dto/update-experientialevent.dto';
import {
  deleteImageFromS3,
  uploadImageToS3,
} from '../../common/utils/s3-upload.util';
import { OrderService } from '../order/order.service';
import { OrderAvailabilityService } from '../order/services/order-availability.service';
import { extractS3KeyFromUrl } from '../../common/utils/s3-upload.util';
const lookupAndUnwind = (
  localField: string,
  from: string,
  as: string,
  projectFields: Record<string, 1> = {},
  unwind: boolean = true,
): PipelineStage[] => {
  const stages: PipelineStage[] = [
    {
      $lookup: {
        from,
        localField,
        foreignField: '_id',
        as,
        pipeline: [{ $project: projectFields }],
      },
    },
  ];

  if (unwind) {
    stages.push({
      $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true },
    });
  }

  return stages;
};

@Injectable()
export class ExperientialEventService {
  constructor(
    @InjectModel(ExperientialEvent.name)
    private readonly experientialEventModel: Model<ExperientialEventDocument>,
    private eventChangeHistoryService: EventChangeHistoryService,
    private readonly orderService: OrderService,
    private readonly orderAvailabilityService: OrderAvailabilityService,
    private readonly vendorAvailabilityService: VendorAvailabilityService,
  ) {}

  // ✅ Create event → save as pending for approval
  async create(dto: any, user: any): Promise<ExperientialEventDocument> {
    // Convert ObjectId fields inside pendingChanges
    const pendingChanges: any = { ...dto };

    if (
      dto.experientialEventCategory &&
      Types.ObjectId.isValid(dto.experientialEventCategory)
    ) {
      pendingChanges.experientialEventCategory = new Types.ObjectId(
        dto.experientialEventCategory,
      );
    }

    if (dto.subExperientialEventCategory) {
      pendingChanges.subExperientialEventCategory =
        dto.subExperientialEventCategory;
      pendingChanges.subExperientialEventCategory = new Types.ObjectId(
        dto.subExperientialEventCategory,
      );
      // .filter((id: string) => Types.ObjectId.isValid(id))
      // .map((id: string) => new Types.ObjectId(id));
    }

    // if (dto.addOns && Array.isArray(dto.addOns)) {
    //   pendingChanges.addOns = dto.addOns
    //     .filter((id: string) => Types.ObjectId.isValid(id))
    //     .map((id: string) => new Types.ObjectId(id));
    // }

    // Create the document
    const created = new this.experientialEventModel({
      title: dto.title,
      createdBy: user.vendorId,
      eventUpdateStatus: 'pending',
      pendingChanges,
    });

    return await created.save();
  }

  // ✅ Get event by id
  async getById(eventId: string): Promise<ExperientialEventDocument> {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException('Experiential Event not found');
    }
    return event;
  }
  async getByIdWithAggregate(eventId: string): Promise<any> {
    const pipeline: PipelineStage[] = [
      { $match: { _id: new Types.ObjectId(eventId) } },
      ...lookupAndUnwind(
        'experientialEventCategory',
        'dropdownoptions',
        'experientialEventCategory',
        { name: 1, label: 1, value: 1 },
        true,
      ),

      ...lookupAndUnwind(
        'pendingChanges.experientialEventCategory',
        'dropdownoptions',
        'pendingChanges.experientialEventCategory',
        { name: 1, label: 1, value: 1 },
      ),

      ...lookupAndUnwind(
        'pendingChanges.subExperientialEventCategory',
        'subexperientialeventcategories',
        'pendingChanges.subExperientialEventCategory',
        { name: 1 },
        true,
      ),
      ...lookupAndUnwind(
        'subExperientialEventCategory',
        'subexperientialeventcategories',
        'subExperientialEventCategory',
        { name: 1, value: 1 },
        true,
      ),
    ];

    const results = await this.experientialEventModel.aggregate(pipeline);

    const event = results[0];

    if (!event) return null;

    // 🧩 Convert `_id` → `id` and stringify ObjectId
    const jsonEvent = {
      id: event._id?.toString(),
      ...event,
    };
    delete jsonEvent._id;

    return jsonEvent;
  }

  // ✅ List with pagination & filters

  async getExperientialEventListByAdmin(
    options: AdminQueryExperientialEventDto,
  ): Promise<any> {
    const {
      page = 1,
      limit = 10,
      sortBy,
      eventDate,
      city,
      ...filter
    } = options;

    // --- Base match filter ---
    const match: any = {};

    if (filter.ageGroup) match.ageGroup = filter.ageGroup;
    if (filter.title) match.title = filter.title;
    if (filter.totalBookings) match.totalBookings = filter.totalBookings;

    // ✅ DTO already converts boolean properly
    if (typeof filter.isShowcaseEvent === 'boolean') {
      match.isShowcaseEvent = filter.isShowcaseEvent;
    }

    if (typeof filter.isActive === 'boolean') {
      match.isActive = filter.isActive;
    }

    if (typeof filter.isVerify === 'boolean') {
      match.isVerify = filter.isVerify;
    }

    if (filter.eventUpdateStatus) {
      match.eventUpdateStatus = filter.eventUpdateStatus;
    }

    if (filter.createdBy) {
      match.createdBy = filter.createdBy;
    }

    // --- Price range filter ---
    if (filter.priceRange) {
      const [minStr, maxStr] = filter.priceRange.split('-');
      const min = minStr ? Number(minStr) : undefined;
      const max = maxStr ? Number(maxStr) : undefined;

      if (min !== undefined || max !== undefined) {
        match['tiers.price'] = {};
        if (min !== undefined && !isNaN(min)) match['tiers.price'].$gte = min;
        if (max !== undefined && !isNaN(max)) match['tiers.price'].$lte = max;
      }
    }

    // --- City filter ---
    if (city?.length) {
      match['city.name'] = { $in: city };
    }

    // --- Category filters ---
    if (filter.experientialEventCategory) {
      match.experientialEventCategory = new Types.ObjectId(
        filter.experientialEventCategory,
      );
    }

    if (filter.subExperientialEventCategory?.length) {
      match.subExperientialEventCategory = {
        $in: filter.subExperientialEventCategory.map(
          (id) => new Types.ObjectId(id),
        ),
      };
    }

    // --- Event date filter ---
    let startOfDay: Date | null = null;
    let endOfDay: Date | null = null;

    if (eventDate) {
      startOfDay = new Date(eventDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(eventDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
    }

    // --- Helper for lookup + unwind ---
    const lookupAndUnwind = (
      localField: string,
      from: string,
      as: string,
      projectFields: Record<string, 1> = {},
      unwind = true,
    ): PipelineStage[] => {
      const stages: PipelineStage[] = [
        {
          $lookup: {
            from,
            localField,
            foreignField: '_id',
            as,
            pipeline: [{ $project: projectFields }],
          },
        },
      ];

      if (unwind) {
        stages.push({
          $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true },
        });
      }

      return stages;
    };

    // --- Build pipeline ---
    const pipeline: PipelineStage[] = [{ $match: match }];

    // Categories & subcategories
    pipeline.push(
      ...lookupAndUnwind(
        'experientialEventCategory',
        'dropdownoptions',
        'experientialEventCategory',
        { name: 1, label: 1, value: 1 },
      ),
      ...lookupAndUnwind(
        'pendingChanges.experientialEventCategory',
        'dropdownoptions',
        'pendingChanges.experientialEventCategory',
        { name: 1, label: 1, value: 1 },
      ),
      ...lookupAndUnwind(
        'subExperientialEventCategory',
        'subexperientialeventcategories',
        'subExperientialEventCategory',
        { name: 1, value: 1 },
        true,
      ),
      ...lookupAndUnwind(
        'pendingChanges.subExperientialEventCategory',
        'subexperientialeventcategories',
        'pendingChanges.subExperientialEventCategory',
        { name: 1 },
        true,
      ),
    );

    // --- Orders for specific event date ---
    if (eventDate) {
      pipeline.push(
        {
          $lookup: {
            from: 'orders',
            let: { eventId: '$_id', cityName: '$city.name' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$event._id', '$$eventId'] },
                      { $gte: ['$eventBookingDate', startOfDay] },
                      { $lte: ['$eventBookingDate', endOfDay] },
                      city?.length
                        ? { $eq: ['$eventAddress.city', city[0]] }
                        : {},
                    ].filter(Boolean),
                  },
                },
              },
            ],
            as: 'ordersOnDate',
          },
        },
        { $addFields: { bookingCount: { $size: '$ordersOnDate' } } },
        {
          $match: {
            $expr: {
              $lt: [
                '$bookingCount',
                { $ifNull: [{ $max: '$city.maxBookingsPerDay' }, Infinity] },
              ],
            },
          },
        },
      );
    }

    // --- Projection ---
    pipeline.push({
      $project: {
        title: 1,
        banner: 1,
        duration: 1,
        city: 1,
        description: 1,
        tiers: 1,
        tags: 1,
        discount: 1,
        isVerify: 1,
        isActive: 1,
        isBlocked: 1,
        totalBookings: 1,
        subCategory: 1,
        eventUpdateStatus: 1,
        createdAt: 1,
        isShowcaseEvent: 1,
        pendingChanges: 1,
        experientialEventCategory: 1,
        subExperientialEventCategory: 1,
        ...(eventDate && { bookingCount: 1 }),
      },
    });

    // --- Sorting ---
    let sortStage: any = { createdAt: -1 };

    if (sortBy) {
      sortStage = {};
      sortBy.split(',').forEach((s: string) => {
        const key = s.replace(':desc', '').replace(':asc', '').trim();
        sortStage[key] = s.includes(':desc') ? -1 : 1;
      });
    }

    pipeline.push(
      { $sort: sortStage },
      { $skip: (page - 1) * limit },
      { $limit: Number(limit) },
    );
    console.log('match data for filter evp. event', match);
    // --- Execute ---
    const [events, total] = await Promise.all([
      this.experientialEventModel.aggregate(pipeline),
      this.experientialEventModel.countDocuments(match),
    ]);

    return {
      results: events,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      totalResults: total,
    };
  }
  // async getPublishedEvent(options: any = {}): Promise<any> {
  //   const {
  //     page = 1,
  //     limit = 10,
  //     sortBy,
  //     eventDate,
  //     city,
  //     ...filter
  //   } = options;

  //   // --- Base match filter ---
  //   const match: any = { isActive: true, isVerify: true, isBlocked: false };
  //   if (filter.ageGroup) match.ageGroup = filter.ageGroup;
  //   if (filter.title) match.title = filter.title;
  //   if (filter.totalBookings) match.totalBookings = filter.totalBookings;

  //   // Price range filter
  //   if (filter.priceRange) {
  //     const [minStr, maxStr] = filter.priceRange.split('-');
  //     const min = minStr ? Number(minStr) : undefined;
  //     const max = maxStr ? Number(maxStr) : undefined;

  //     if (min !== undefined || max !== undefined) {
  //       match['tiers.price'] = {};
  //       if (min !== undefined && !isNaN(min)) match['tiers.price'].$gte = min;
  //       if (max !== undefined && !isNaN(max)) match['tiers.price'].$lte = max;
  //     }
  //   }

  //   // City filter
  //   if (city) {
  //     match['city.name'] = { $in: Array.isArray(city) ? city : [city] };
  //   }

  //   // Category filters
  //   if (filter.experientialEventCategory)
  //     match.experientialEventCategory = new Types.ObjectId(filter.experientialEventCategory);

  //   if (filter.subExperientialEventCategory)
  //     match.subExperientialEventCategory = {
  //       $in: Array.isArray(filter.subExperientialEventCategory)
  //         ? filter.subExperientialEventCategory.map((id: string) => new Types.ObjectId(id))
  //         : [new Types.ObjectId(filter.subExperientialEventCategory)],
  //     };

  //   // Event date filter
  //   let startOfDay: Date | null = null;
  //   let endOfDay: Date | null = null;
  //   if (eventDate) {
  //     startOfDay = new Date(eventDate);
  //     startOfDay.setUTCHours(0, 0, 0, 0);
  //     endOfDay = new Date(eventDate);
  //     endOfDay.setUTCHours(23, 59, 59, 999);
  //   }

  //   // --- Helper for lookup + unwind ---
  //   const lookupAndUnwind = (
  //     localField: string,
  //     from: string,
  //     as: string,
  //     projectFields: Record<string, 1> = {},
  //     unwind = true
  //   ): PipelineStage[] => {
  //     const stages: PipelineStage[] = [
  //       { $lookup: { from, localField, foreignField: '_id', as, pipeline: [{ $project: projectFields }] } },
  //     ];
  //     if (unwind) stages.push({ $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } });
  //     return stages;
  //   };

  //   // --- Build pipeline ---
  //   const pipeline: PipelineStage[] = [{ $match: match }];

  //   // Categories & subcategories
  //   pipeline.push(
  //     ...lookupAndUnwind('experientialEventCategory', 'dropdownoptions', 'experientialEventCategory', { name: 1, label: 1, value: 1 }),
  //     ...lookupAndUnwind('pendingChanges.experientialEventCategory', 'dropdownoptions', 'pendingChanges.experientialEventCategory', { name: 1, label: 1, value: 1 }),
  //     ...lookupAndUnwind('subExperientialEventCategory', 'subexperientialeventcategories', 'subExperientialEventCategory', { name: 1, value: 1 }, false),
  //     ...lookupAndUnwind('pendingChanges.subExperientialEventCategory', 'subexperientialeventcategories', 'pendingChanges.subExperientialEventCategory', { name: 1 })
  //   );

  //   // Orders for specific event date (if given)
  //   if (eventDate) {
  //     pipeline.push(
  //       {
  //         $lookup: {
  //           from: 'orders',
  //           let: { eventId: '$_id', cityName: '$city.name' },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     { $eq: ['$event._id', '$$eventId'] },
  //                     { $gte: ['$eventBookingDate', startOfDay] },
  //                     { $lte: ['$eventBookingDate', endOfDay] },
  //                     city ? { $eq: ['$eventAddress.city', Array.isArray(city) ? city[0] : city] } : {},
  //                   ].filter(Boolean),
  //                 },
  //               },
  //             },
  //           ],
  //           as: 'ordersOnDate',
  //         },
  //       },
  //       { $addFields: { bookingCount: { $size: '$ordersOnDate' } } },
  //       {
  //         $match: {
  //           $expr: {
  //             $lt: ['$bookingCount', { $ifNull: [{ $max: '$city.maxBookingsPerDay' }, Infinity] }],
  //           },
  //         },
  //       }
  //     );
  //   }

  //   // Projection
  //   pipeline.push({
  //     $project: {
  //       title: 1,
  //       banner: 1,
  //       duration: 1,
  //       city: 1,
  //       description: 1,
  //       tiers: 1,
  //       tags: 1,
  //       discount: 1,
  //       isVerify: 1,
  //       isActive: 1,
  //       isBlocked: 1,
  //       totalBookings: 1,
  //       subCategory: 1,
  //       eventUpdateStatus: 1,
  //       createdAt: 1,
  //       pendingChanges: 1,
  //       experientialEventCategory: 1,
  //       subExperientialEventCategory: 1,
  //       ...(eventDate && { bookingCount: 1 }),
  //     },
  //   });

  //   // Sorting
  //   let sortStage: any = { createdAt: -1 };
  //   if (sortBy) {
  //     if (typeof sortBy === 'string') {
  //       sortStage = {};
  //       sortBy.split(',').forEach((s: string) => {
  //         const key = s.replace(':desc', '').replace(':asc', '').trim().replace('[0]', '.0');
  //         sortStage[s.includes(':desc') ? key : key] = s.includes(':desc') ? -1 : 1;
  //       });
  //     } else Object.assign(sortStage, sortBy);
  //   }
  //   pipeline.push({ $sort: sortStage }, { $skip: (page - 1) * limit }, { $limit: Number(limit) });

  //   // --- Fetch events ---
  //   const events = await this.experientialEventModel.aggregate(pipeline);

  //   // --- Total count ---
  //   const total = await this.experientialEventModel.countDocuments(match);

  //   return {
  //     results: events,
  //     page: Number(page),
  //     limit: Number(limit),
  //     totalPages: Math.ceil(total / limit),
  //     totalResults: total,
  //   };
  // }

  // ✅ Vendor submits update → goes into pendingChanges
  // async submitUpdate(
  //   eventId: string,
  //   updateData: any,
  //   updatedBy: string,
  // ): Promise<ExperientialEventDocument> {
  //   const event = await this.experientialEventModel.findById(eventId);
  //   if (!event) {
  //     throw new NotFoundException('Experiential Event not found');
  //   }

  //   event.pendingChanges = event.pendingChanges || {};
  //   Object.assign(event.pendingChanges, updateData, {
  //     updatedAt: new Date(),
  //     updatedBy,
  //   });

  //   event.eventUpdateStatus = 'pending';
  //   event.eventUpdateReason = undefined;

  //   return await event.save();
  // }
  async submitUpdate(
    eventId: string,
    updateData: Partial<UpdateExperientialEventDto>,
    updatedBy: string,
  ): Promise<ExperientialEventDocument> {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const allowedFields = [
      'title',
      'description',
      'duration',
      'city',
      'banner',
      'tiers',
      'tags',
      'subCategory',
      'experientialEventCategory',
      'subExperientialEventCategory',
      'coreActivity',
      'discount',
    ];

    event.pendingChanges = event.pendingChanges || {};
    const pending = event.pendingChanges;

    const changes: Record<string, { old: any; new: any }> = {};

    // ✅ Track changes
    allowedFields.forEach((field) => {
      if (field in updateData && updateData[field] !== undefined) {
        const oldValue = (event as any)[field];
        const newValue = updateData[field];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          pending[field] = newValue;
          changes[field] = { old: oldValue, new: newValue };
        }
      }
    });

    event.pendingChanges.updatedAt = new Date();
    event.pendingChanges.updatedBy = updatedBy;
    event.eventUpdateStatus = 'pending';
    event.markModified('pendingChanges');

    const saved = await event.save();

    // ✅ Log vendor changes
    await this.eventChangeHistoryService.logChange(
      new Types.ObjectId(eventId),
      new Types.ObjectId(updatedBy),
      'vendor',
      changes,
    );

    return saved;
  }

  //update event  by admin
  async adminUpdateEvent(
    eventId: string,
    updateData: UpdateExperientialEventByAdminDto,
    adminId: string,
  ): Promise<ExperientialEventDocument> {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');

    if (
      !event.pendingChanges ||
      Object.keys(event.pendingChanges).length === 0
    ) {
      throw new BadRequestException('No pending changes to edit');
    }

    const pending = event.pendingChanges;

    const allowedFields = [
      'title',
      'description',
      'duration',
      'ageGroup',
      'city',
      'banner',
      'tiers',
      'delight',
      'tags',
      'subCategory',
      'experientialEventCategory',
      'subExperientialEventCategory',
      'coreActivity',
      'discount',
    ];
    3;

    for (const field of allowedFields) {
      if (!(field in pending)) continue;
      const value = updateData[field];
      if (value === undefined) continue;
      console.log('field is ', field);
      console.log('value is ', value);
      if (field === 'city') {
        const existingCities = pending.city || [];
        const updatedCities = value || [];

        const cityMap = new Map(
          [...existingCities, ...updatedCities].map((city) => [
            city.name.toLowerCase().trim(),
            { ...city },
          ]),
        );
        pending.city = Array.from(cityMap.values());
      } else if (field === 'tiers') {
        const existingTiers = pending.tiers || [];
        const updatedTiers = value || [];

        const tierMap = new Map(
          [...existingTiers, ...updatedTiers].map((tier) => [
            tier.name.toLowerCase().trim(),
            { ...tier },
          ]),
        );
        pending.tiers = Array.from(tierMap.values());
      } else if (field === 'banner') {
        pending.banner = value;
      } else {
        pending[field] = value;
      }
    }

    // 🧹 Handle banner removal (new feature)
    if (updateData.removeBanners?.length) {
      const bannersToRemove = updateData.removeBanners;

      // Remove from pendingChanges.banner (if exists)
      if (Array.isArray(pending.banner)) {
        pending.banner = pending.banner.filter(
          (url) => !bannersToRemove.includes(url),
        );
      }

      // Remove from main event banner (if exists)
      if (Array.isArray(event.banner)) {
        event.banner = event.banner.filter(
          (url) => !bannersToRemove.includes(url),
        );
      }

      // Delete from S3 in parallel
      await Promise.allSettled(
        bannersToRemove.map(async (bannerUrl) => {
          const key = extractS3KeyFromUrl(bannerUrl);
          if (!key) return;
          try {
            await deleteImageFromS3({ key });
          } catch (err) {
            console.error(
              `❌ Failed to delete banner: ${bannerUrl}`,
              err.message,
            );
          }
        }),
      );
    }

    event.markModified('pendingChanges');
    return await event.save();
  }

  async addBannerByAdmin(
    eventId: string,
    bannerUrls: string[],
    adminId: string,
  ): Promise<ExperientialEventDocument> {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');

    if (!Array.isArray(event.banner)) event.banner = [];

    // 🧩 Insert new banners at start of the array
    event.banner = [...bannerUrls, ...event.banner];

    // Update metadata
    // event.updatedAt = new Date();
    // (event as any).updatedBy = new Types.ObjectId(adminId);

    await event.save();
    return event;
  }

  async approveUpdate(
    eventId: string,
    adminId: string,
  ): Promise<ExperientialEventDocument> {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const pending = event.pendingChanges;
    if (!pending || Object.keys(pending).length === 0) {
      throw new BadRequestException('No pending changes to approve');
    }

    // 🔁 Apply pending changes
    for (const [key, value] of Object.entries(pending)) {
      if (key === 'tiers') {
        const newTiers = Array.isArray(value)
          ? (value as Array<{
              _id?: string | Types.ObjectId;
              price: number;
              name: string;
              description: string;
              venueSize: string;
              features: string[];
            }>)
          : [];

        if (!Array.isArray(event.tiers)) event.tiers = [];

        const existingTierMap = new Map<string, any>();
        event.tiers.forEach((tier: any) => {
          if (tier._id) existingTierMap.set(tier._id.toString(), tier);
          if (tier.name) existingTierMap.set(tier.name.toLowerCase(), tier);
        });

        for (const tier of newTiers) {
          let updated = false;

          if (tier._id && existingTierMap.has(tier._id.toString())) {
            const existing = existingTierMap.get(tier._id.toString());
            Object.assign(existing, tier);
            updated = true;
          } else if (
            tier.name &&
            existingTierMap.has(tier.name.toLowerCase())
          ) {
            const existing = existingTierMap.get(tier.name.toLowerCase());
            Object.assign(existing, tier);
            updated = true;
          }

          if (!updated) {
            event.tiers.push(tier);
          }
        }
      } else if (key === 'city') {
        const newCities = Array.isArray(value) ? (value as any[]) : [];
        if (!Array.isArray(event.city)) event.city = [];

        const cityMap = new Map<string, any>();
        [...event.city, ...newCities].forEach((city) => {
          if (city && city.name) {
            cityMap.set(city.name.toLowerCase().trim(), city);
          }
        });

        event.city = Array.from(cityMap.values());
      }

      // 🖼 Banner merge logic (newly added)
      else if (key === 'banner') {
        // 🖼 Merge banner arrays safely (don’t replace old)
        const newBanners = (Array.isArray(value) ? value : []).filter(
          (b): b is string => typeof b === 'string',
        );

        if (!Array.isArray(event.banner)) event.banner = [];

        // Merge and remove duplicates (new first if needed)
        const merged = Array.from(new Set([...event.banner, ...newBanners]));

        event.banner = merged;
      } else {
        (event as any)[key] = value;
      }
    }

    // ✅ Finalize approval
    event.eventUpdateStatus = 'approved';
    event.isVerify = true;
    event.isActive = true;
    event.pendingChanges = {};

    const saved = await event.save();

    await this.eventChangeHistoryService.logChange(
      new Types.ObjectId(eventId),
      new Types.ObjectId(adminId),
      'admin',
      saved.toObject(),
      'approved',
    );

    return saved;
  }

  // ==========================

  async rejectUpdate(eventId: string, reason: string, adminId: string) {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');

    if (
      !event.pendingChanges ||
      Object.keys(event.pendingChanges).length === 0
    ) {
      throw new BadRequestException('No pending changes found');
    }

    // ✅ Prepare rejected data (only pendingChanges)
    const rejectedChanges = event.pendingChanges;

    // Log rejection
    await this.eventChangeHistoryService.logChange(
      new Types.ObjectId(eventId),
      new Types.ObjectId(adminId),
      'admin',
      {
        ...rejectedChanges,
        reason,
      },
      'rejected',
    );

    // Update event record
    event.eventUpdateStatus = 'rejected';
    event.eventUpdateReason = reason;
    event.pendingChanges = {};

    const saved = await event.save();

    return {
      message: 'Event update rejected and logged successfully',
      data: saved,
    };
  }

  // ✅ Get event with pending changes
  async getWithPendingChanges(
    eventId: string,
  ): Promise<ExperientialEventDocument> {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException('Experiential Event not found');
    }
    return event;
  }

  // 🔹 Alias for controller compatibility
  async getEventWithPendingChanges(eventId: string) {
    const objectId = new Types.ObjectId(eventId);

    // Helper function for lookups with optional unwind
    // const lookupAndUnwind = (
    //   localField: string,
    //   from: string,
    //   as: string,
    //   projectFields: Record<string, 1> = {},
    //   unwind: boolean = true,
    // ): PipelineStage[] => {
    //   const stages: PipelineStage[] = [
    //     {
    //       $lookup: {
    //         from,
    //         localField,
    //         foreignField: '_id',
    //         as,
    //         pipeline: [{ $project: projectFields }],
    //       },
    //     },
    //   ];

    //   if (unwind) {
    //     stages.push({ $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } });
    //   }

    //   return stages;
    // };

    const pipeline: PipelineStage[] = [
      { $match: { _id: objectId } },

      // 🔹 Lookup for main category
      ...lookupAndUnwind(
        'experientialEventCategory',
        'dropdownoptions',
        'experientialEventCategory',
        { name: 1, label: 1, value: 1 },
      ),

      // 🔹 Lookup for pending category
      ...lookupAndUnwind(
        'pendingChanges.experientialEventCategory',
        'dropdownoptions',
        'pendingChanges.experientialEventCategory',
        { name: 1, label: 1, value: 1 },
      ),

      // 🔹 Lookup for subcategory (keep as array, no unwind)
      ...lookupAndUnwind(
        'subExperientialEventCategory',
        'subexperientialeventcategories',
        'subExperientialEventCategory',
        { name: 1, value: 1 },
        true, // ✅ true means unwind = true
      ),
      // 🔹 Lookup for pending subcategory
      ...lookupAndUnwind(
        'pendingChanges.subExperientialEventCategory',
        'subexperientialeventcategories',
        'pendingChanges.subExperientialEventCategory',
        { name: 1 },
        true,
      ),
      ...lookupAndUnwind('createdBy', 'vendors', 'createdBy', {
        name: 1,
        fullName: 1,
        email: 1,
      }),
      ...lookupAndUnwind(
        'addOns',
        'categories',
        'addOns',
        { name: 1, icon: 1 },
        false,
      ),

      // 🔹 Final projection
      {
        $project: {
          title: 1,
          banner: 1,
          duration: 1,
          city: 1,
          description: 1,
          tiers: 1,
          tags: 1,
          discount: 1,
          isVerify: 1,
          isActive: 1,
          isBlocked: 1,
          createdBy: 1,
          addOns: 1,
          totalBookings: 1,
          subCategory: 1,
          eventUpdateStatus: 1,
          createdAt: 1,
          pendingChanges: 1,
          isShowcaseEvent: 1,
          experientialEventCategory: 1,
          subExperientialEventCategory: 1,
        },
      },
    ];

    const result = await this.experientialEventModel.aggregate(pipeline);
    if (result[0].eventUpdateStatus == 'rejected') {
      let getEventHistory =
        await this.eventChangeHistoryService.getChangeHistoryForEventByEventAndStatus(
          eventId,
          'rejected',
        );
    }
    let getEventHistory =
      await this.eventChangeHistoryService.getChangeHistoryForEvent(eventId);

    return { ...result[0], eventHistory: getEventHistory };
  }
  async getPublishedEvent(eventId: string) {
    const objectId = new Types.ObjectId(eventId);

    // Helper function for lookups with optional unwind
    // const lookupAndUnwind = (
    //   localField: string,
    //   from: string,
    //   as: string,
    //   projectFields: Record<string, 1> = {},
    //   unwind: boolean = true,
    // ): PipelineStage[] => {
    //   const stages: PipelineStage[] = [
    //     {
    //       $lookup: {
    //         from,
    //         localField,
    //         foreignField: '_id',
    //         as,
    //         pipeline: [{ $project: projectFields }],
    //       },
    //     },
    //   ];

    //   if (unwind) {
    //     stages.push({ $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } });
    //   }

    //   return stages;
    // };

    const pipeline: PipelineStage[] = [
      {
        $match: {
          _id: objectId,
          isActive: true,
          isVerify: true,
          isBlocked: false,
        },
      },

      // 🔹 Lookup for main category
      ...lookupAndUnwind(
        'experientialEventCategory',
        'dropdownoptions',
        'experientialEventCategory',
        { name: 1, label: 1, value: 1 },
      ),

      // 🔹 Lookup for pending category
      ...lookupAndUnwind(
        'pendingChanges.experientialEventCategory',
        'dropdownoptions',
        'pendingChanges.experientialEventCategory',
        { name: 1, label: 1, value: 1 },
      ),

      // 🔹 Lookup for subcategory (keep as array, no unwind)
      ...lookupAndUnwind(
        'subExperientialEventCategory',
        'subexperientialeventcategories',
        'subExperientialEventCategory',
        { name: 1, value: 1 },
        true,
      ),

      // 🔹 Lookup for pending subcategory
      ...lookupAndUnwind(
        'pendingChanges.subExperientialEventCategory',
        'subexperientialeventcategories',
        'pendingChanges.subExperientialEventCategory',
        { name: 1 },
        true,
      ),

      // 🔹 Final projection
      {
        $project: {
          title: 1,
          banner: 1,
          duration: 1,
          city: 1,

          exclusion: 1,
          description: 1,
          tiers: 1,
          tags: 1,
          discount: 1,
          isVerify: 1,

          totalBookings: 1,
          subCategory: 1,
          eventUpdateStatus: 1,
          createdAt: 1,

          isShowcaseEvent: 1,
          // pendingChanges: 1,
          experientialEventCategory: 1,
          subExperientialEventCategory: 1,
        },
      },
    ];

    const result = await this.experientialEventModel.aggregate(pipeline);
    if (result[0]?.eventUpdateStatus == 'rejected') {
      let getEventHistory =
        await this.eventChangeHistoryService.getChangeHistoryForEventByEventAndStatus(
          eventId,
          'rejected',
        );
    }
    let getEventHistory =
      await this.eventChangeHistoryService.getChangeHistoryForEvent(eventId);

    return { ...result[0], eventHistory: getEventHistory };
  }

  // ✅ List all pending updates for admin
  async getPendingUpdates(options: any = {}): Promise<any> {
    const { page = 1, limit = 10, sortBy = '-updatedAt', ...filter } = options;

    const query = {
      eventUpdateStatus: 'pending',
      pendingChanges: { $exists: true, $ne: null },
      ...filter,
    };

    return (this.experientialEventModel as any).paginate(query, {
      page: Number(page),
      limit: Number(limit),
      sort: sortBy,
    });
  }

  // 🔹 Alias for controller compatibility
  async getPendingEvents(options: any = {}) {
    return this.getPendingUpdates(options);
  }

  // ✅ List approved events
  async listApprovedEvents(options: any = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy, 
      eventDate,
      city,

      ...filter
    } = options;

    console.log('filter options:', filter);
    console.log(' options:', options);

    // Base match filter: only approved experiential events
    const match: any = {
      isActive: true,
      isVerify: true,
      isBlocked: false,
      isDeleted: false,
    };

    if (filter.ageGroup) match.ageGroup = filter.ageGroup;
    if (filter.title) match.title = filter.title;
    if (filter.totalBookings) match.totalBookings = filter.totalBookings;
    if (filter.isShowcaseEvent == 'true') match.isShowcaseEvent = true;
    if (filter.search) {
      const searchRegex = new RegExp(filter.search, 'i');

      match.$and = [
        {
          $or: [
            { title: searchRegex },
            { tags: searchRegex },
            { description: searchRegex },
            { 'city.name': searchRegex },
          ],
        },
      ];
    }
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
      match['city.name'] = { $in: Array.isArray(city) ? city : [city] };
    }

    if (filter.experientialEventCategory)
      match.experientialEventCategory = new Types.ObjectId(
        filter.experientialEventCategory,
      );
    if (filter.subExperientialEventCategory)
      match.subExperientialEventCategory = {
        $in: Array.isArray(filter.subExperientialEventCategory)
          ? filter.subExperientialEventCategory.map(
              (id: string) => new Types.ObjectId(id),
            )
          : [new Types.ObjectId(filter.subExperientialEventCategory)],
      };
    // Convert eventDate to day range
    let startOfDay: Date | null = null;
    let endOfDay: Date | null = null;
    if (eventDate) {
      startOfDay = new Date(eventDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(eventDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
    }

    console.log('final matched data ', match);

    // --- Aggregation pipeline ---
    const pipeline: any[] = [{ $match: match }];
    pipeline.push(
      {
        $lookup: {
          from: 'dropdownoptions',
          localField: 'experientialEventCategory',
          foreignField: '_id',
          as: 'experientialEventCategory',
          pipeline: [{ $project: { name: 1, value: 1, label: 1 } }],
        },
      },
      {
        $unwind: {
          path: '$experientialEventCategory',
          preserveNullAndEmptyArrays: true,
        },
      },
    );

    pipeline.push(
      {
        $lookup: {
          from: 'subexperientialeventcategories',
          localField: 'subExperientialEventCategory',
          foreignField: '_id',
          as: 'subExperientialEventCategory',
          pipeline: [
            { $project: { name: 1, value: 1, experientialEventCategoryId: 1 } },
          ],
        },
      },
      {
        $unwind: {
          path: '$subExperientialEventCategory',
          preserveNullAndEmptyArrays: true,
        },
      },
    );

    // Sort handling
    let sortStage: any = { createdAt: -1 }; // default
    if (sortBy) {
      if (typeof sortBy === 'string') {
        sortStage = {};
        sortBy.split(',').forEach((s: string) => {
          if (s.includes(':desc')) {
            sortStage[s.replace(':desc', '').replace('[0]', '.0').trim()] = -1;
          } else {
            sortStage[s.replace(':asc', '').replace('[0]', '.0').trim()] = 1;
          }
        });
      } else if (typeof sortBy === 'object') {
        sortStage = {};
        Object.entries(sortBy).forEach(([k, v]) => {
          sortStage[k.replace('[0]', '.0')] = v;
        });
      }
    }

    pipeline.push({ $sort: sortStage });
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: Number(limit) });

    pipeline.push(
      {
        $lookup: {
          from: 'commissions',
          localField: '_id',
          foreignField: 'eventId',
          as: 'commissionData',
        },
      },
      {
        $unwind: {
          path: '$commissionData',
          preserveNullAndEmptyArrays: true,
        },
      },
    );

    // Projection
    pipeline.push({
      $project: {
        title: 1,
        banner: 1,
        description: 1,
        duration: 1,
        city: 1,
        createdBy: 1,

        //MAP TIERS WITH PRICING
        tiers: {
          $map: {
            input: '$tiers',
            as: 't',
            in: {
              $mergeObjects: [
                '$$t',
                {
                  pricing: {
                    $let: {
                      vars: {
                        matchedTier: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: '$commissionData.tiers',
                                as: 'ct',
                                cond: { $eq: ['$$ct.tierId', '$$t._id'] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: {
                        userPayment: '$$matchedTier.pricing.userPayment',
                      },
                    },
                  },
                },
              ],
            },
          },
        },

        tags: 1,
        isShowcaseEvent: 1,
        discount: 1,

        totalBookings: 1,
        experientialEventCategory: 1,
        subExperientialEventCategory: 1,
        createdAt: 1,
        ...(eventDate && { bookingCount: 1 }),
      },
    });

    const events = await this.experientialEventModel.aggregate(pipeline);

    let results = events.map((event) => ({
      ...event,
      bookingCount: 0,
      isBookingFull: false,
    }));

    if (eventDate && events.length) {
      const startOfDay = new Date(eventDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(eventDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const eventIds = events.map((e) => e._id);
      const vendorIds = events.map((e) => e.createdBy);

      const [bookings, vendorAvailabilities] = await Promise.all([
        this.orderAvailabilityService.getBookingCountsForEvents({
          eventIds,
          city,
          startDate: startOfDay,
          endDate: endOfDay,
        }),

        this.vendorAvailabilityService.getAvailabilitiesForVendors(vendorIds),
      ]);
      console.log('bookings is a event', bookings, vendorAvailabilities);
      const bookingMap = new Map(
        bookings.map((b) => [b._id.toString(), b.bookingCount]),
      );

      const vendorMap = new Map(
        vendorAvailabilities.map((v) => [v.vendorId.toString(), v]),
      );

      results = events.map((event) => {
        const availability = vendorMap.get(event.createdBy?.toString());

        const vendorAvailable =
          this.vendorAvailabilityService.checkVendorAvailabilityLocal(
            availability,
            new Date(eventDate),
          );

        if (!vendorAvailable) {
          return {
            ...event,
            bookingCount: 0,
            isBookingFull: true,
            vendorUnavailable: true,
          };
        }

        const bookingCount = bookingMap.get(event._id.toString()) || 0;

        const cityConfig = event.city?.find(
          (c: any) => c.name.toLowerCase() === city?.toLowerCase(),
        );

        const maxBookings = cityConfig?.maxBookingsPerDay || Infinity;

        return {
          ...event,
          bookingCount,
          isBookingFull: bookingCount >= maxBookings,
          vendorUnavailable: false,
        };
      });
    }
    const total = await this.experientialEventModel.countDocuments(match);
    return {
      results, 
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      totalResults: total,
    };
  }

  async listEventsByVendor(
    vendorId: string,
    filters: any = {},
    options: any = {},
  ) {
    const { page = 1, limit = 10, sortBy, ...filter } = options;

    // --- Base filter for vendor's events ---
    const match: any = { createdBy: vendorId };
    if (filter.ageGroup) match.ageGroup = filter.ageGroup;
    if (filter.title) match.title = filter.title;
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

    if (filter.isShowcaseEvent == 'true') match.isShowcaseEvent = true;
    if (filter.experientialEventCategory)
      match.experientialEventCategory = new Types.ObjectId(
        filter.experientialEventCategory,
      );
    if (filter.subExperientialEventCategory)
      match.subExperientialEventCategory = {
        $in: Array.isArray(filter.subExperientialEventCategory)
          ? filter.subExperientialEventCategory.map(
              (id: string) => new Types.ObjectId(id),
            )
          : [new Types.ObjectId(filter.subExperientialEventCategory)],
      };

    // --- Helper for lookup + unwind ---
    const lookupAndUnwind = (
      localField: string,
      from: string,
      as: string,
      projectFields: Record<string, 1> = {},
      unwind = true,
    ): PipelineStage[] => {
      const stages: PipelineStage[] = [
        {
          $lookup: {
            from,
            localField,
            foreignField: '_id',
            as,
            pipeline: [{ $project: projectFields }],
          },
        },
      ];
      if (unwind)
        stages.push({
          $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true },
        });
      return stages;
    };

    // --- Build aggregation pipeline ---
    const pipeline: PipelineStage[] = [
      { $match: match },

      // Categories lookups
      ...lookupAndUnwind(
        'experientialEventCategory',
        'dropdownoptions',
        'experientialEventCategory',
        { name: 1, label: 1, value: 1 },
      ),
      ...lookupAndUnwind(
        'pendingChanges.experientialEventCategory',
        'dropdownoptions',
        'pendingChanges.experientialEventCategory',
        { name: 1, label: 1, value: 1 },
      ),

      // Subcategories
      ...lookupAndUnwind(
        'subExperientialEventCategory',
        'subexperientialeventcategories',
        'subExperientialEventCategory',
        { name: 1, value: 1 },
        true,
      ),
      ...lookupAndUnwind(
        'pendingChanges.subExperientialEventCategory',
        'subexperientialeventcategories',
        'pendingChanges.subExperientialEventCategory',
        { name: 1 },
        true,
      ),

      // Project needed fields
      {
        $project: {
          title: 1,
          banner: 1,
          isActive: 1,
          isBlocked: 1,
          description: 1,
          isVerify: 1,
          isShowcaseEvent: 1,
          duration: 1,
          city: 1,
          tiers: 1,
          tags: 1,
          discount: 1,
          eventUpdateStatus: 1,

          eventUpdateReason: 1,
          totalBookings: 1,
          experientialEventCategory: 1,
          subExperientialEventCategory: 1,
          pendingChanges: 1,
          createdAt: 1,
        },
      },
    ];

    // --- Sorting ---
    const sortStage: any = {};
    if (sortBy) {
      if (typeof sortBy === 'string') {
        sortBy.split(',').forEach((s: string) => {
          if (s.includes(':desc'))
            sortStage[s.replace(':desc', '').trim()] = -1;
          else sortStage[s.replace(':asc', '').trim()] = 1;
        });
      } else Object.assign(sortStage, sortBy);
    } else sortStage.createdAt = -1;

    pipeline.push(
      { $sort: sortStage },
      { $skip: (page - 1) * limit },
      { $limit: Number(limit) },
    );

    // --- Fetch events ---
    const events = await this.experientialEventModel.aggregate(pipeline);
    const eventIds = events.map((e: any) => e._id);

    // --- Fetch last rejected changes ---
    const rejectedMap =
      await this.eventChangeHistoryService.getLastRejectedChanges(eventIds);

    // --- Merge pending/rejected changes and format ---
    const formattedEvents = events.map((event) => {
      const rejected = rejectedMap[event._id.toString()] || {};
      let baseData = {
        ...event,
        eventUpdateStatus: event.eventUpdateStatus || 'approved',
        lastRejectedChanges: rejected.lastRejectedChanges || null,
        lastRejectedReason: rejected.lastRejectedReason || null,
        rejectedAt: rejected.rejectedAt || null,
      };

      // Apply pending changes if event is pending
      if (
        !event.isVerify &&
        event.eventUpdateStatus === 'pending' &&
        event.pendingChanges
      ) {
        baseData = {
          ...baseData,
          ...event.pendingChanges,
          eventUpdateStatus: 'pending',
        };
      }

      // Apply rejected changes if event is rejected
      if (
        !event.isVerify &&
        event.eventUpdateStatus === 'rejected' &&
        baseData.lastRejectedChanges
      ) {
        baseData = {
          ...baseData,
          ...baseData.lastRejectedChanges,
          eventUpdateStatus: 'rejected',
        };
      }

      // Clean up helper fields
      delete baseData.pendingChanges;
      delete baseData.lastRejectedChanges;
      delete baseData.rejectedAt;

      return baseData;
    });

    // --- Total count for pagination ---
    const total = await this.experientialEventModel.countDocuments(match);

    return {
      results: formattedEvents,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      totalResults: total,
    };
  }

  // ✅ Get approved event by ID
  async getApprovedEventById(eventId: string) {
    const event = await this.experientialEventModel.findOne({
      _id: new Types.ObjectId(eventId),
      eventUpdateStatus: 'approved',
    });

    if (!event) {
      throw new NotFoundException('Approved event not found');
    }
    return event;
  }

  // experiential-event.service.ts

  private areEqual(a: any, b: any): boolean {
    if (a instanceof Types.ObjectId && b instanceof Types.ObjectId) {
      return a.equals(b);
    }
    return isEqual(a, b);
  }

  async submitEventEditInstance(
    event: ExperientialEventDocument,
    updateData: Partial<UpdateExperientialEventByVendorDto>,
    updatedBy: string,
  ): Promise<ExperientialEventDocument> {
    console.log('updateData incoming experiential ', updateData);
    const pending: Record<string, any> = {};
    const now = new Date();
    const updaterId = new Types.ObjectId(updatedBy);

    const plainUpdate = instanceToPlain(updateData);
    console.log('plain data in edit ', plainUpdate);
    const hasValueChanged = (key: keyof typeof updateData): boolean =>
      updateData[key] !== undefined && !isEqual(updateData[key], event[key]);
    if (updateData.experientialEventCategory) {
      const oldCat =
        event.pendingChanges?.experientialEventCategory?.toString() ??
        event.experientialEventCategory?.toString();

      const newCat = updateData.experientialEventCategory.toString();

      if (oldCat !== newCat) {
        pending.experientialEventCategory = new Types.ObjectId(newCat);
        console.log('🟠 Category changed — storing in pending');
      } else {
        console.log('🟩 Category unchanged — skipping');
      }
    }

    if (updateData.subExperientialEventCategory) {
      const oldId =
        event.pendingChanges?.subExperientialEventCategory?.toString() ??
        event.subExperientialEventCategory?.toString();

      const newId = updateData.subExperientialEventCategory.toString();

      if (newId !== oldId) {
        pending.subExperientialEventCategory = new Types.ObjectId(newId);
        console.log('🟠 Subcategory changed — storing in pending');
      } else {
        console.log('🟩 Subcategory unchanged — skipping');
      }
    }

    // Helper: merge pending changes safely
    const mergePendingChanges = async () => {
      if (!Object.keys(pending).length) {
        console.log('🟩 No pending changes detected — skipping save');
        return;
      }

      pending.updatedAt = now;
      pending.updatedBy = updaterId;

      event.pendingChanges = {
        ...(event.pendingChanges ?? {}),
        ...pending,
      };

      event.eventUpdateStatus = 'pending';
      await event.save();

      console.log('✅ Pending changes saved:', Object.keys(pending));
    };

    // 1️⃣ Simple scalar fields
    const simpleFields: (keyof typeof updateData)[] = [
      'title',
      'description',
      'duration',
      'discount',
      'tags',
    ];

    for (const field of simpleFields) {
      if (hasValueChanged(field)) {
        pending[field] = updateData[field];
      }
    }

    // 2️⃣ Core Activity
    if (
      Array.isArray(updateData.coreActivity) &&
      !isEqual(updateData.coreActivity, event.coreActivity)
    ) {
      pending.coreActivity = [...updateData.coreActivity];
    }

    // 3️⃣ City Comparison
    if (updateData.city) {
      const normalizeCity = (c: any) => ({
        name: (c.name ?? '').toLowerCase().trim(),
        maxBookingsPerDay: Number(c.maxBookingsPerDay) || 0,
      });

      const oldCities = (event.city ?? []).map(normalizeCity);
      const newCities = (
        Array.isArray(plainUpdate.city) ? plainUpdate.city : [plainUpdate.city]
      ).map(normalizeCity);

      const oldMap = new Map(oldCities.map((c) => [c.name, c]));
      const newMap = new Map(newCities.map((c) => [c.name, c]));

      const changed = [...newMap.entries()].some(([name, newC]) => {
        const oldC = oldMap.get(name);
        return !oldC || oldC.maxBookingsPerDay !== newC.maxBookingsPerDay;
      });

      if (changed) {
        pending.city = structuredClone(newCities);
        console.log('✅ City changes detected — stored in pending');
      }
    }
    // 4️⃣ Tiers Comparison
    if (updateData.tiers) {
      const normalize = (n: string) => n?.toLowerCase().trim();

      // 🟤 Convert existing tiers to plain comparable form
      const oldTiers = (event.tiers ?? []).map((t: any) => {
        const plain = t.toObject?.() ?? t;
        return {
          ...plain,
          name: normalize(plain.name),
        };
      });

      // 🟡 Convert new tiers → plain objects
      const newTiers = instanceToPlain(updateData.tiers).map((t: any) => ({
        ...t,
        name: normalize(t.name),
      }));

      const oldMap = new Map(oldTiers.map((t) => [t.name, t]));
      const newMap = new Map(newTiers.map((t) => [t.name, t]));

      // 🟢 Collect only changed or newly added tiers
      const changedTiers: any[] = [];

      for (const [name, newTier] of newMap.entries()) {
        const oldTier = oldMap.get(name);

        if (!oldTier) {
          // newly added tier
          changedTiers.push(newTier);
          continue;
        }

        // 🧹 Ignore _id and __v when comparing
        const oldClean = omit(oldTier, ['_id', '__v']);
        const newClean = omit(newTier, ['_id', '__v']);

        if (!isEqual(oldClean, newClean)) {
          changedTiers.push(newTier);
        }
      }

      // ✅ Only store changed tiers if any actually changed
      if (changedTiers.length > 0) {
        pending.tiers = changedTiers;
      }
    }

    // 5️⃣ Experiential Event Category
    if (updateData.experientialEventCategory) {
      const oldCat = event.experientialEventCategory?.toString();
      const newCat = updateData.experientialEventCategory?.toString();

      if (oldCat && newCat && oldCat !== newCat) {
        pending.experientialEventCategory = new Types.ObjectId(newCat);
        console.log('🟠 Category changed — storing in pending');
      } else {
        console.log('🟩 Category unchanged — skipping');
      }
    }

    // 6️⃣ Subcategory
    if (updateData.subExperientialEventCategory) {
      const normalizeArray = (val: any) => (Array.isArray(val) ? val : [val]);

      const oldSub = normalizeArray(event.subExperientialEventCategory);
      const newSub = normalizeArray(updateData.subExperientialEventCategory);

      const oldId = oldSub[0]?.toString() ?? null;
      const newId = newSub[0]?.toString() ?? null;

      if (oldId !== newId && newId) {
        pending.subExperientialEventCategory = [new Types.ObjectId(newId)];
        console.log('🟠 Subcategory changed — storing in pending');
      }
    }

    // 7️⃣ Banner Management
    const existingBanners = event.banner ?? [];
    const keptBanners = updateData.existingBanners ?? [];
    const newBanners = updateData.addBanner ?? [];

    const finalBanners = [...keptBanners, ...newBanners];
    const deletedBanners = existingBanners.filter(
      (b) => !finalBanners.includes(b),
    );

    if (newBanners.length > 0) pending.banner = newBanners;

    if (deletedBanners.length > 0) {
      await Promise.allSettled(
        deletedBanners.map(async (url) => {
          const key = extractS3KeyFromUrl(url);
          if (!key) return;
          try {
            await deleteImageFromS3({ key });
          } catch (err) {
            console.error(`❌ Failed to delete S3 image: ${url}`, err.message);
          }
        }),
      );
    }

    // 🕒 Save if any change detected
    await mergePendingChanges();
    return event;
  }

  async updateActive(eventId: string) {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }
    event.isActive = !event.isActive;
    await event.save();
    return event;
  }
  async updateShowCase(eventId: string) {
    // ===== Validate Input =====
    if (!eventId) {
      throw new BadRequestException('Event ID is required.');
    }

    // ===== Retrieve Event =====
    const event = await this.experientialEventModel
      .findById(eventId)
      .select('isShowcaseEvent');

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // ===== Determine New Toggle State =====
    const enableShowcase = !event.isShowcaseEvent;

    // ===== Validate Showcase Limit Only When Enabling =====
    if (enableShowcase) {
      const activeShowcaseCount =
        await this.experientialEventModel.countDocuments({
          isShowcaseEvent: true,
          _id: { $ne: eventId }, // avoid counting itself
        });

      if (activeShowcaseCount >= 9) {
        throw new BadRequestException(
          'Showcase limit reached. Only 9 items are allowed.',
        );
      }
    }

    // ===== Apply Update =====
    event.isShowcaseEvent = enableShowcase;
    await event.save();

    // ===== Response =====
    return {
      success: true,
      message: enableShowcase
        ? 'Event added to showcase.'
        : 'Event removed from showcase.',
      data: {
        id: eventId,
        isShowcaseEvent: event.isShowcaseEvent,
      },
    };
  }

  async updateBlock(eventId: string) {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }
    event.isBlocked = !event.isBlocked;
    await event.save();
    return event;
  }
  async updateAddOns(eventId: string, addOns: Types.ObjectId[]) {
    const event = await this.experientialEventModel.findById(eventId);

    if (!event) throw new NotFoundException('Event not found');

    event.addOns = addOns;
    await event.save();
    return event;
  }

  async removeBannerByAdmin(
    eventId: string,
    bannerUrl: string,
    adminId: string,
  ): Promise<ExperientialEventDocument> {
    const event = await this.experientialEventModel.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');
    let removedFrom: 'main' | 'pending' | null = null;

    // --- 1️⃣ Try removing from main event.banner ---
    if (Array.isArray(event.banner) && event.banner.length > 0) {
      const index = event.banner.findIndex((url) => url === bannerUrl);
      if (index !== -1) {
        event.banner.splice(index, 1);
        removedFrom = 'main';
      }
    }

    // --- 2️⃣ If not found, check pendingChanges.banner ---
    if (!removedFrom && event.pendingChanges?.banner?.length) {
      const index = event.pendingChanges.banner.findIndex(
        (url) => url === bannerUrl,
      );
      if (index !== -1) {
        event.pendingChanges.banner.splice(index, 1);
        removedFrom = 'pending';
        event.markModified('pendingChanges.banner');
      }
    }

    // --- 3️⃣ If still not found, throw error ---
    if (!removedFrom) {
      throw new NotFoundException(
        'Banner not found in event or pending changes',
      );
    }

    // --- 4️⃣ Try deleting from S3 safely ---
    const s3Key = extractS3KeyFromUrl(bannerUrl);
    if (s3Key) {
      try {
        await deleteImageFromS3({ key: s3Key });
        console.log(`🧹 Deleted banner from S3: ${s3Key}`);
      } catch (err) {
        console.error(`⚠️ Failed to delete from S3: ${bannerUrl}`, err.message);
      }
    }

    // --- 6️⃣ Save changes ---
    await event.save();

    return event;
  }

  async deleteByAdmin(id: Types.ObjectId): Promise<ExperientialEventDocument> {
    const event = await this.experientialEventModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, isActive: false } },
      { new: true, runValidators: false },
    );

    if (!event) {
      throw new NotFoundException(
        'Experiential event not found or already deleted',
      );
    }

    return event;
  }
}
