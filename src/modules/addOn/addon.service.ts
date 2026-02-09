import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { instanceToPlain } from 'class-transformer';
import { Model, Types, PipelineStage } from 'mongoose'; // 👈 Added Types import
import { AddOn, AddOnDocument } from './addon.schema';
import { Category } from '../category/category.schema';
import { CreateAddOnDto } from './dto/create-addon.dto';
import { UpdateAddOnDto } from './dto/update-addon.dto';
import { VendorAvailabilityService } from '../vendoravailability/vendor-availability.service'; // Adjust path
import { AdminQueryAddOnDto, UpdatePendingAddOnDto } from './dto/admin-addons.dto';
import { FilterQuery, SortOrder } from 'mongoose';
import { PublicQueryAddOnDto } from './dto/public-query-addon.dto';
import { VendorQueryAddOnDto } from './dto/vendor-addons.dto';
import { lookupAndUnwind } from 'src/common/utils/mongoose-lookup.util';
import { AuthUser } from 'src/modules/auth/types/auth-user.type';
import { VendorEditAddOnDto } from './dto/update-addon.dto';
import { extractS3KeyFromUrl } from "../../common/utils/s3-upload.util";
import { deleteImageFromS3 } from 'src/common/utils/s3-upload.util';
import { AddOnHistoryService } from '../addon-history/addon-history.service';
import logger from '../../common/utils/logger';
import { City } from 'src/modules/city/city.schema';
import { add } from 'winston';

import { normalizeToDateOnly } from '../vendoravailability/availability.utils';

function extractNewValues(changes) {
  const result = {};

  for (const key in changes) {
    if (!changes[key]) continue;

    // If it's simple "oldValue / newValue" format
    if (typeof changes[key] === "object" && "newValue" in changes[key]) {
      result[key] = changes[key].newValue;
    }
  }

  return result;
}



@Injectable()
export class AddOnService {
  constructor(
    @InjectModel(AddOn.name)
    private readonly addOnModel: Model<AddOn>,
    private readonly vendorAvailabilityService: VendorAvailabilityService,
    private readonly addonHistoryService: AddOnHistoryService,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
  ) { }
  async create(dto: CreateAddOnDto, vendorId: Types.ObjectId): Promise<AddOnDocument> {
    // if (!user) throw new BadRequestException('User information is required');
    console.log("Creating AddOn with DTO:", dto,);
    // 🧱 Prepare pendingChanges (for admin approval flow)
    const pendingChanges: AddOn['pendingChanges'] = {
      ...dto,
      updatedAt: new Date(),
      updatedBy: vendorId,
    };

    // 🧩 Convert string -> ObjectId for category
    // if (dto.category && typeof dto.category === 'string') {
    //   if (!Types.ObjectId.isValid(dto.category)) {
    //     throw new BadRequestException('Invalid category ObjectId');
    //   }
    //   pendingChanges.category = new Types.ObjectId(dto.category);
    // }

    // 👷 Create a new AddOn instance
    const createdAddOn = new this.addOnModel({
      name: dto.name,
      createdBy: vendorId,
      updateStatus: 'pending',
      pendingChanges,
    });

    // 💾 Save to MongoDB
    const saved = await createdAddOn.save();
    return saved;
  }


  async getAddonById(addOnId: string) {
    const objectId = new Types.ObjectId(addOnId);
    const addOn = await this.addOnModel.findById(objectId);
    return addOn;
  }

  async getAddOnsListByAdmin(query: AdminQueryAddOnDto) {
    logger.info(`getAddOnsListByAdminV2 called with query: ${JSON.stringify(query)}`);

    const {
      search,
      category,
      city,
      isActive,
      createdBy,
      popular,
      isVerify,
      updateStatus,
      page = 1,
      limit = 10,
      sortBy = 'createdAt:desc',
      select, // ✅ NEW
    } = query;

    // 🧩 1️⃣ Build filters
    const filter: Record<string, any> = {};

    if (search?.trim()) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      const categoryId = new Types.ObjectId(category);
      filter.$or = [
        { category: categoryId },
        { 'pendingChanges.category': categoryId },
      ];
    }

    if (city) {
      filter.$or = [
        { 'cityOfOperation.name': city },
        { 'pendingChanges.cityOfOperation.name': city },
      ];
    }

    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (typeof popular === 'boolean') filter.popular = popular;
    if (typeof isVerify === 'boolean') filter.isVerify = isVerify;
    if (createdBy) filter.createdBy = createdBy;
    if (updateStatus) filter.updateStatus = updateStatus;

    // 🧮 2️⃣ Sort parsing
    const sort: Record<string, 1 | -1> = {};
    if (sortBy) {
      const [field, order] = sortBy.split(':');
      sort[field] = order === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    // ⚙️ 3️⃣ Pagination math
    const skip = (Number(page) - 1) * Number(limit);
    const perPage = Math.max(Number(limit), 1);

    // ---------------------------
    // ✅ SELECT → DYNAMIC PROJECT
    // ---------------------------
    let dynamicProject: Record<string, any> | null = null;

    if (select) {
      dynamicProject = { _id: 1 };

      select
        .split(',')
        .map((f) => f.trim())
        .forEach((field) => {
          dynamicProject![field] = 1;
        });
    }

    // 🧠 4️⃣ Build aggregation pipeline
    const pipeline: PipelineStage[] = [
      { $match: filter },
      { $sort: sort },

      ...lookupAndUnwind('category', 'categories', 'category', {
        _id: 1,
        name: 1,
        label: 1,
      }),
      ...lookupAndUnwind(
        'pendingChanges.category',
        'categories',
        'pendingChanges.category',
        {
          _id: 1,
          name: 1,
          label: 1,
        },
      ),

      ...lookupAndUnwind('createdBy', 'vendors', 'createdBy', {
        _id: 1,
        firstName: 1,
        lastName: 1,
      }),

      {
        $addFields: {
          banner: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$pendingChanges.banner', []] } }, 0] },
              { $arrayElemAt: ['$pendingChanges.banner', 0] },
              { $arrayElemAt: ['$banner', 0] },
            ],
          },
          totalCities: {
            $size: {
              $ifNull: [
                {
                  $cond: [
                    {
                      $gt: [
                        { $size: { $ifNull: ['$pendingChanges.cityOfOperation', []] } },
                        0,
                      ],
                    },
                    '$pendingChanges.cityOfOperation',
                    '$cityOfOperation',
                  ],
                },
                [],
              ],
            },
          },
          totalTiers: {
            $size: {
              $ifNull: [
                {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$pendingChanges.tiers', []] } }, 0] },
                    '$pendingChanges.tiers',
                    '$tiers',
                  ],
                },
                [],
              ],
            },
          },
          name: { $ifNull: ['$pendingChanges.name', '$name'] },
          category: { $ifNull: ['$pendingChanges.category', '$category'] },
        },
      },

      // ✅ FINAL PROJECTION (STATIC OR DYNAMIC)
      dynamicProject
        ? { $project: dynamicProject }
        : {
          $project: {
            _id: 1,
            name: 1,
            category: {
              _id: 1,
              name: 1,
              label: 1,
            },
            createdBy: {
              _id: 1,
              firstName: 1,
              lastName: 1,
            },
            banner: 1,
            exclusion: 1,
            totalCities: 1,
            totalTiers: 1,
            updateStatus: 1,
            isActive: 1,
            popular: 1,
            createdAt: 1,
          },
        },

      { $skip: skip },
      { $limit: perPage },
    ];

    // 📊 5️⃣ Execute
    const [data, totalCount] = await Promise.all([
      this.addOnModel.aggregate(pipeline),
      this.addOnModel.countDocuments(filter),
    ]);

    // ✅ 6️⃣ Response
    return {
      success: true,
      message: data.length ? 'Add-ons fetched successfully' : 'No add-ons found',
      results: data,
      totalResults: totalCount,
      totalPages: Math.ceil(totalCount / perPage),
      currentPage: Number(page),
      limit: perPage,
    };
  }




  async getAddOnDetailsByAdmin(addOnId: string) {
    const objectId = new Types.ObjectId(addOnId);

    const pipeline: PipelineStage[] = [
      { $match: { _id: objectId } },

      // 🏷️ Populate category
      ...lookupAndUnwind('category', 'categories', 'category', { name: 1, label: 1 }, true),

      // 👤 Populate createdBy (Vendor)
      ...lookupAndUnwind('createdBy', 'vendors', 'createdBy', {
        firstName: 1,
        lastName: 1,
        email: 1,
      }, true),

      // 🕒 Populate pendingChanges.category
      ...lookupAndUnwind(
        'pendingChanges.category',
        'categories',
        'pendingChangesCategory',
        { name: 1, label: 1 }, true
      ),

      // 🔄 Replace pendingChanges.category with populated data
      {
        $addFields: {
          'pendingChanges.category': '$pendingChangesCategory',
        },
      },

      // 🧹 Clean temporary field
      { $project: { pendingChangesCategory: 0 } },
    ];

    const [addOn] = await this.addOnModel.aggregate(pipeline);

    if (!addOn) {
      throw new NotFoundException('AddOn not found');
    }

    return addOn;
  }


  async getPublicAddOnById(addOnId: string) {
    const objectId = new Types.ObjectId(addOnId);
    console.log("Fetching public AddOn by ID:", addOnId);

    const pipeline: PipelineStage[] = [
      { $match: { _id: objectId, isActive: true, isVerify: true } },

      // Lookup category (select only name, label)
      ...lookupAndUnwind('category', 'categories', 'category', { name: 1, label: 1 }),

      // Optional: lookup createdBy vendor name (if needed for UI)
      ...lookupAndUnwind('createdBy', 'vendors', 'createdBy', { businessName: 1 }, false),

      {
        $project: {
          // ✅ Only public-facing fields
          name: 1,
          description: 1,
          banner: 1,
          tags: 1,
          category: 1,
          tiers: 1,
          exclusion: 1,
          cityOfOperation: 1,
          maxBookingsPerDay: 1,
          maxQuantity: 1,
          createdAt: 1,
          updatedAt: 1,



        },
      },
    ];

    const result = await this.addOnModel.aggregate(pipeline);

    if (!result.length) {
      throw new NotFoundException('Add-On not found or inactive');
    }

    // Convert _id → id
    const addOn = result[0];
    addOn.id = addOn._id?.toString();
    delete addOn._id;

    return addOn;
  }

  // add-on.service.ts
  async approveAddOn(
    addOnId: string,
    adminId: Types.ObjectId,
    reason?: string,
  ): Promise<AddOnDocument> {
    const addOn = await this.addOnModel.findById(addOnId);
    if (!addOn) throw new NotFoundException('Add-on not found');

    const pending = addOn.pendingChanges;
    if (!pending || Object.keys(pending).length === 0) {
      throw new BadRequestException('No pending changes to approve');
    }
    const { pendingChanges, ...oldData } = addOn.toObject();

    // Apply pending changes...
    for (const [key, value] of Object.entries(pending)) {
      if (key === 'banner') {
        const newBanners = Array.isArray(value)
          ? value.filter((v): v is string => typeof v === 'string')
          : [];
        const merged = Array.from(new Set([...(addOn.banner || []), ...newBanners]));
        addOn.banner = merged;
      } else if (key === 'tiers' && Array.isArray(value)) {
        // Ensure all tiers have required fields
        addOn.tiers = value.map((tier: any) => ({
          price: tier.price ?? 0,
          name: tier.name ?? '',
          description: tier.description ?? '',
          duration: tier.duration ?? '',
          guest: tier.guest ?? '',
          features: tier.features ?? [],
        }));
      } else {
        (addOn as any)[key] = value;
      }
    }

    await this.addonHistoryService.recordHistory({
      addOnId: addOn._id,
      updatedBy: adminId,
      updatedByRole: 'admin', // 'admin' or 'vendor'
      oldData,  // You might want to fetch the old data before saving
      newData: addOn.pendingChanges || {},
      updateStatus: 'approved',
      comment: 'Addon updated by admin',
    });
    // ✅ Approval logic
    addOn.updateStatus = 'approved';
    addOn.isVerify = true;
    addOn.pendingChanges = {};
    addOn.isActive = true;

    // Optional: Store the reason
    if (reason) (addOn as any).approvalNote = reason;




    console.log("after recording history");
    const saved = await addOn.save();
    return saved;
  }


  async rejectAddOn(
    addOnId: string,
    reason: string,
    adminId: Types.ObjectId,
  ): Promise<{ message: string; data: AddOnDocument }> {
    const addOn = await this.addOnModel.findById(addOnId);
    if (!addOn) throw new NotFoundException('Add-on not found');

    if (!addOn.pendingChanges || Object.keys(addOn.pendingChanges).length === 0) {
      throw new BadRequestException('No pending changes found');
    }

    // const rejectedChanges = addOn.pendingChanges;

    // Optionally log the rejection
    const { pendingChanges, ...oldData } = addOn.toObject();
    // const rejectedChanges = addOn.pendingChanges;

    // Optionally log the rejection
    await this.addonHistoryService.recordHistory({
      addOnId: addOn._id,
      updatedBy: adminId,
      updatedByRole: 'admin', // 'admin' or 'vendor'
      oldData,  // You might want to fetch the old data before saving
      newData: addOn.pendingChanges || {},
      updateStatus: 'rejected',
      comment: 'Addon updated by admin',
    });

    addOn.updateStatus = 'rejected';
    (addOn as any).updateReason = reason;
    await this.addonHistoryService.recordHistory({
      addOnId: addOn._id,
      updatedBy: adminId,
      updatedByRole: 'admin', // 'admin' or 'vendor'
      oldData: addOn, // You might want to fetch the old data before saving
      newData: addOn.pendingChanges,
      updateStatus: 'rejected',
      comment: 'Addon updated by admin',
    });
    addOn.pendingChanges = {};

    const saved = await addOn.save();

    return {
      message: 'Add-on update rejected successfully',
      data: saved,
    };
  }

  async toggleActiveByVendor(id: string, vendorId: Types.ObjectId) {
    const addOn = await this.addOnModel.findById(id);
    if (!addOn) throw new NotFoundException('Add-on not found');
    if (String(addOn.createdBy) !== String(vendorId)) throw new ForbiddenException('Unauthorized');
    addOn.isActive = !addOn.isActive;
    await addOn.save();
    return addOn;
  }

  async toggleBlockByAdmin(id: string) {

    const addOn = await this.addOnModel.findById(id);
    if (!addOn) throw new NotFoundException('Add-on not found');
    addOn.isBlock = !addOn.isBlock;
    await addOn.save();
    return addOn;
  }

  async getPublicAddOns(query: PublicQueryAddOnDto) {
    const {
      search,
      category,
      city,
      createdBy,
      addOns,
      categoryId,
      date,
      popular,
      page = 1,
      limit = 10,
      sortBy,
    } = query;

    // 🧩 Build Mongo filter
    const filter: FilterQuery<AddOnDocument> = {
      isActive: true,
      isVerify: true,

      // ✅ better than isBlock:false because it includes missing field
      isBlock: { $ne: true },
    };

    // ✅ Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    // ✅ categoryId / addOns filter
    if (categoryId || addOns) {
      try {
        const rawIds = (categoryId || addOns)
          .split(',')
          .map((id: string) => id.trim())
          .filter((id) => Types.ObjectId.isValid(id))
          .map((validId) => new Types.ObjectId(validId));

        if (rawIds.length > 0) {
          filter.category = { $in: rawIds };
        }
      } catch (err) {
        console.warn('Invalid category/addOns filter input', err);
      }
    }

    if (category && Types.ObjectId.isValid(category)) {
      filter.category = new Types.ObjectId(category);
    }

    if (city) filter['cityOfOperation.name'] = city;
    if (createdBy) filter.createdBy = createdBy;
    if (typeof popular === 'boolean') filter.popular = popular;

    // 🧭 Pagination options
    const options = {
      page: Number(page),
      limit: Number(limit),
      sortBy,
      select:
        'name description price tiers exclusion category banner popular isActive createdAt createdBy cityOfOperation',
      populate: 'category:name label;',
      lean: true,
    };

    console.log('🧩 Public AddOns Filter:', filter);
    console.log('🧩 Public AddOns Options:', options);

    // ⚡ paginate
    const result = await (this.addOnModel as any).paginate(filter, options);

    // ✅ plugin format safety
    if (!result || !Array.isArray(result.results)) {
      return {
        success: true,
        message: 'Public Add-ons fetched successfully',
        results: [],
        page: Number(page),
        limit: Number(limit),
        totalPages: 0,
        totalResults: 0,
        hasNextPage: false,
        hasPrevPage: false,
        prevPage: null,
        nextPage: null,
      };
    }

    // ✅ filter only results if date is provided
    if (date) {
      const targetDate = normalizeToDateOnly(date);

      const addons = result.results;
console.log(" total result before ")
      const vendorIds: string[] = Array.from(
        new Set<string>(
          addons
            .map((a: any) => a?.createdBy?.toString())
            .filter(
              (id: any): id is string =>
                typeof id === 'string' && Types.ObjectId.isValid(id),
            ),
        ),
      );

      if (vendorIds.length === 0) {
        // ✅ no vendor ids => empty
        result.results = [];
        result.totalResults = 0;
        result.totalPages = 0;
        result.hasPrevPage = false;
        result.hasNextPage = false;
        result.prevPage = null;
        result.nextPage = null;
      } else {
        const vendorAvailabilities =
          await this.vendorAvailabilityService.getAvailabilitiesForVendors(vendorIds);

        // ✅ Map vendorId -> availability
        const availabilityMap = new Map<string, any>();
        vendorAvailabilities.forEach((avail: any) => {
          if (avail?.vendorId) {
            availabilityMap.set(avail.vendorId.toString(), avail);
          }
        });

        // ✅ Filter addons based on availability
        const filteredResults = addons.filter((addon: any) => {
          const vendorId = addon?.createdBy?.toString();
          if (!vendorId) return false;

          const availability = availabilityMap.get(vendorId);

          return this.vendorAvailabilityService.checkVendorAvailabilityLocal(
            availability,
            targetDate,
          );
        });

        // ✅ replace results
        result.results = filteredResults;

        // ✅ recompute meta correctly
        result.totalResults = filteredResults.length;

        // ✅ totalPages should be 0 if 0 results
        result.totalPages =
          filteredResults.length === 0
            ? 0
            : Math.ceil(filteredResults.length / Number(limit));

        result.hasPrevPage = Number(page) > 1 && result.totalPages > 0;
        result.hasNextPage = Number(page) < result.totalPages; // ✅ FIXED

        result.prevPage = result.hasPrevPage ? Number(page) - 1 : null;
        result.nextPage = result.hasNextPage ? Number(page) + 1 : null;
      }
    }

    return {
      success: true,
      message: 'Public Add-ons fetched successfully',
      ...result,
    };
  }


  // 📁 src/addOn/addon.service.ts


  // async getAddOnsListByVendor(vendorId: string, query: VendorQueryAddOnDto) {
  //   const {
  //     search,
  //     category,
  //     city,
  //     isActive,
  //     popular,
  //     updateStatus,
  //     page = 1,
  //     limit = 10,
  //     sortBy = 'createdAt:desc',
  //     select,
  //     populate,
  //     cursor,
  //   } = query;

  //   // 🧠 Build safe filter
  //   const filter: FilterQuery<AddOnDocument> = { createdBy: vendorId };

  //   if (search) {
  //     filter.$or = [
  //       { name: { $regex: search, $options: 'i' } },
  //       { description: { $regex: search, $options: 'i' } },
  //     ];
  //   }

  //   if (category) filter.category = category;
  //   if (city) filter.cityOfOperation = { $in: [city] };
  //   if (typeof isActive === 'boolean') filter.isActive = isActive;
  //   if (typeof popular === 'boolean') filter.popular = popular;
  //   if (updateStatus) filter.updateStatus = updateStatus;

  //   // 🧮 Pagination options
  //   const options = {
  //     page,
  //     limit,
  //     sort: { createdAt: -1 },
  //     select:
  //       select ||
  //       'name description price cityOfOperation exclusion category popular isActive updateStatus createdAt',
  //     populate:
  //       populate ||
  //       'category:name,label;createdBy:firstName,lastName,email',
  //     lean: true,
  //   };

  //   console.log('Filter for Vendor AddOns:', filter);
  //   console.log('Options for Vendor AddOns:', options);

  //   const result = await (this.addOnModel as any).paginate(filter, options);

  //   return {
  //     success: true,
  //     message: 'Vendor Add-ons fetched successfully',
  //     ...result,
  //   };
  // }
  async getAddOnsListByVendor(vendorId: string, query: VendorQueryAddOnDto) {

    const {
      search,
      category,
      city,
      isActive,

      popular,
      isVerify,
      updateStatus,
      page = 1,
      limit = 10,
      sortBy = 'createdAt:desc',
    } = query;

    // 🧩 1️⃣ Build filters
    const vendorObjectId = new Types.ObjectId(vendorId);
    const filter: Record<string, any> = { createdBy: vendorObjectId };

    if (search?.trim()) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      const categoryId = new Types.ObjectId(category);
      filter.$or = [
        { category: categoryId },
        { 'pendingChanges.category': categoryId },
      ];
    }

    if (city) {

      filter.$or = [
        { 'cityOfOperation.name': city },
        { 'pendingChanges.cityOfOperation.name': city },
      ];
    }


    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (typeof popular === 'boolean') filter.popular = popular;
    if (typeof isVerify === 'boolean') filter.isVerify = isVerify;

    if (updateStatus) filter.updateStatus = updateStatus;

    // 🧮 2️⃣ Sort parsing
    const sort: Record<string, 1 | -1> = {};
    if (sortBy) {
      const [field, order] = sortBy.split(':');
      sort[field] = order === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    // ⚙️ 3️⃣ Pagination math
    const skip = (Number(page) - 1) * Number(limit);
    const perPage = Math.max(Number(limit), 1);
    console.log("filter in the service", filter);
    // 🧠 4️⃣ Build aggregation pipeline
    const pipeline: PipelineStage[] = [
      { $match: filter },
      { $sort: sort },

      // ✅ Category lookup (using helper)
      ...lookupAndUnwind('category', 'categories', 'category', {
        _id: 1,
        name: 1,
        label: 1,
      }),
      ...lookupAndUnwind('pendingChanges.category', 'categories', 'pendingChanges.category', {
        _id: 1,
        name: 1,
        label: 1,
      }),

      // ✅ CreatedBy lookup (using helper)
      ...lookupAndUnwind('createdBy', 'vendors', 'createdBy', {
        _id: 1,
        firstName: 1,
        lastName: 1,

      }),


      // ✅ Merge pendingChanges and compute totals
      {
        $addFields: {
          banner: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$pendingChanges.banner', []] } }, 0] },
              { $arrayElemAt: ['$pendingChanges.banner', 0] },
              { $arrayElemAt: ['$banner', 0] },
            ],
          },
          totalCities: {
            $size: {
              $ifNull: [
                {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$pendingChanges.cityOfOperation', []] } }, 0] },
                    '$pendingChanges.cityOfOperation',
                    '$cityOfOperation',
                  ],
                },
                [],
              ],
            },
          },
          totalTiers: {
            $size: {
              $ifNull: [
                {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$pendingChanges.tiers', []] } }, 0] },
                    '$pendingChanges.tiers',
                    '$tiers',
                  ],
                },
                [],
              ],
            },
          },
          name: { $ifNull: ['$pendingChanges.name', '$name'] },
          category: { $ifNull: ['$pendingChanges.category', '$category'] },
        },
      },

      // ✅ Projection (final shape)
      {
        $project: {
          _id: 1,
          name: 1,
          category: {
            _id: 1,
            name: 1,
            label: 1,
          },
          createdBy: {
            _id: 1,
            firstName: 1,
            lastName: 1,

          },
          banner: 1,
          exclusion: 1,
          totalCities: 1,
          totalTiers: 1,
          updateStatus: 1,
          updateReason: 1,
          isActive: 1,
          popular: 1,
          createdAt: 1,
        },
      },

      // 🧾 Pagination stages
      { $skip: skip },
      { $limit: perPage },
    ];

    // 📊 5️⃣ Execute in parallel
    const [data, totalCount] = await Promise.all([
      this.addOnModel.aggregate(pipeline),
      this.addOnModel.countDocuments(filter),
    ]);

    // ✅ 6️⃣ Structured `response
    return {
      success: true,
      message: data.length ? 'Add-ons fetched successfully' : 'No add-ons found',
      results: data,
      totalResults: totalCount,
      totalPages: Math.ceil(totalCount / perPage),
      currentPage: Number(page),
      limit: perPage,
    };
  }


  /**
 * 🎯 Vendor: Fetch full Add-On details (with ownership + lookups)
 */
  async getAddOnDetailsForVendor(addOnId: string, vendorId: string) {
    const addOnObjectId = new Types.ObjectId(addOnId);
    const vendorObjectId = new Types.ObjectId(vendorId);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          _id: addOnObjectId,
          createdBy: vendorObjectId, // 🔒 Only the creator vendor can see
        },
      },

      // Join with related collections
      ...lookupAndUnwind('category', 'categories', 'category', { name: 1, label: 1 }),
      ...lookupAndUnwind('createdBy', 'vendors', 'createdBy', {
        businessName: 1,
        email: 1,
      }),
      ...lookupAndUnwind(
        'pendingChanges.category',
        'categories',
        'pendingChanges.category',
        { name: 1, label: 1 },
      ),

      // Only project relevant fields
      {
        $project: {
          name: 1,
          description: 1,
          banner: 1,
          tags: 1,
          category: 1,
          updateReason: 1,
          updateStatus: 1,
          CityOfOperation: 1,
          exclusion: 1,
          tiers: 1,
          isActive: 1,
          isVerify: 1,
          maxQuantity: 1,
          maxBookingsPerDay: 1,
          pendingChanges: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    let [addOn] = await this.addOnModel.aggregate(pipeline);
    addOn = addOn;
    addOn.id = addOn._id?.toString();
    delete addOn._id;

    return addOn || null;
  }


  async editAddOnByVendor(
    id: Types.ObjectId,
    vendorId: Types.ObjectId,
    dto: VendorEditAddOnDto,
  ): Promise<AddOnDocument> {

    console.log("dto in edit ", dto);
    const addOn = await this.addOnModel.findById(id);
    if (!addOn) throw new NotFoundException('Add-on not found');

    // 🔐 Ownership check
    if (String(addOn.createdBy) !== String(vendorId)) {
      throw new ForbiddenException('Unauthorized: You do not own this add-on');
    }
    console.log("Editing AddOn with DTO:", dto);
    // ✅ Only convert nested arrays to plain objects
    const dtoClone: any = { ...dto };

    if (Array.isArray(dtoClone.cityOfOperation)) {
      dtoClone.cityOfOperation = instanceToPlain(dtoClone.cityOfOperation);
    }

    if (Array.isArray(dtoClone.tiers)) {
      dtoClone.tiers = instanceToPlain(dtoClone.tiers);
    }

    console.log('🧩 Plain field fields in DTO:', {
      cityOfOperation: dtoClone.cityOfOperation,
      tiers: dtoClone.tiers,
    });


    const changedFields: Record<string, any> = {};
    const existingPending = addOn.pendingChanges || {};

    for (const [key, newValue] of Object.entries(dtoClone)) {
      const currentValue = (addOn as any)[key];
      const pendingValue = existingPending[key];
      const baseValue = pendingValue ?? currentValue;
      if (key === 'bannerToRemove') continue; // skip helper field
      if (key === 'addBanner') continue; // skip helper field

      if (key === 'cityOfOperation' && Array.isArray(newValue)) {
        const merged = this.mergeCityArrays(baseValue || [], newValue);
        if (merged.length > 0) changedFields[key] = merged;
      }

      else if (key === 'tiers' && Array.isArray(newValue)) {
        const merged = this.mergeTierArrays(baseValue || [], newValue);
        if (merged.length > 0) changedFields[key] = merged;
      }

      else {
        const isEqual = JSON.stringify(baseValue) === JSON.stringify(newValue);
        if (!isEqual) changedFields[key] = newValue;
      }
    }


    if (dto.bannerToRemove?.length) {
      const bannersToRemove = dto.bannerToRemove;

      // Remove from pendingChanges.banner (if exists)
      if (Array.isArray(addOn.pendingChanges?.banner)) {
        addOn.pendingChanges.banner = addOn.pendingChanges.banner.filter((url) => !bannersToRemove.includes(url));
      }

      // Remove from main event banner (if exists)
      if (Array.isArray(addOn.banner)) {
        addOn.banner = addOn.banner.filter((url) => !bannersToRemove.includes(url));
      }

      // Delete from S3 in parallel
      await Promise.allSettled(
        bannersToRemove.map(async (bannerUrl) => {
          const key = extractS3KeyFromUrl(bannerUrl);
          if (!key) return;
          try {
            await deleteImageFromS3({ key });

          } catch (err) {
            console.error(`❌ Failed to delete banner: ${bannerUrl}`, err.message);
          }
        }),
      );
    }
    if (dto.addBanner?.length) {
      console.log("inside the add banner");
      changedFields['banner'] = [
        ...(changedFields.banner ?? []),
        ...(dto.addBanner ?? []),
      ];
    }
    console.log('Changed fields to set in pendingChanges:', changedFields);
    if (Object.keys(changedFields).length === 0) {
      throw new BadRequestException('No actual changes detected');
    }
    addOn.pendingChanges = this.deepMerge(existingPending, changedFields);
    addOn.updateStatus = 'pending';

    return await addOn.save();
  }

  // ✅ Merge logic for cities
  private mergeCityArrays(
    oldCities: Array<{ name: string; maxBookingsPerDay: number }>,
    newCities: Array<{ name: string; maxBookingsPerDay: number }>,
  ) {
    console.log('🔍 Checking city differences...');
    const changed: Array<{ name: string; maxBookingsPerDay: number }> = [];

    for (const newCity of newCities) {
      const oldCity = oldCities.find(
        (c) => c.name.trim().toLowerCase() === newCity.name.trim().toLowerCase(),
      );

      if (!oldCity) {
        changed.push(newCity); // 🆕 new city
      } else if (oldCity.maxBookingsPerDay !== newCity.maxBookingsPerDay) {
        changed.push(newCity); // 🟠 changed city
      }
    }

    return changed;
  }


  // ✅ Merge logic for tiers
  private mergeTierArrays(
    existing: Array<Record<string, any>>,
    incoming: Array<Record<string, any>>,
  ): any[] {
    console.log('🔍 Checking tier differences (ignoring _id & undefined)...');
    console.log('Existing tiers:', existing);
    console.log('Incoming tiers:', incoming);

    const changed: any[] = [];

    // ✅ Safe deep clone and cleanup utility
    const cleanObject = (obj: Record<string, any>) => {
      if (!obj || typeof obj !== 'object') return obj;

      // JSON deep clone fallback (safe for MongoDB documents)
      const clone = JSON.parse(JSON.stringify(obj));

      for (const key in clone) {
        if (
          key === '_id' ||
          clone[key] === undefined ||
          clone[key] === null ||
          (typeof clone[key] === 'string' && clone[key].trim() === '')
        ) {
          delete clone[key];
        }
      }

      return clone;
    };

    // Helper: stable stringify (sorted keys for consistent comparison)
    const stableStringify = (obj: any) =>
      JSON.stringify(obj, Object.keys(obj).sort());

    for (const newTier of incoming) {
      const match = existing.find(
        (t) => t.name?.trim().toLowerCase() === newTier.name?.trim().toLowerCase(),
      );

      if (!match) {
        // 🆕 Entirely new tier
        changed.push(newTier);
        continue;
      }

      const cleanOld = cleanObject(match);
      const cleanNew = cleanObject(newTier);

      const isEqual = stableStringify(cleanOld) === stableStringify(cleanNew);

      if (!isEqual) {
        // 🟠 Changed tier — keep full updated object
        changed.push(newTier);
      }
    }

    console.log('✅ Changed tiers:', changed);
    return changed;
  }
  // ✅ Deep merge utility (safe for nested structures)
  private deepMerge(target: any, source: any): any {
    if (Array.isArray(target) && Array.isArray(source)) {
      // 🧠 Smart array merge — deduplicate by name if available
      const map = new Map<string, any>();

      for (const item of target) {
        const key = item?.name?.toLowerCase?.() ?? JSON.stringify(item);
        map.set(key, item);
      }
      for (const item of source) {
        const key = item?.name?.toLowerCase?.() ?? JSON.stringify(item);
        map.set(key, item); // Replace or add
      }

      return Array.from(map.values());
    }

    if (typeof target === 'object' && typeof source === 'object') {
      const merged: Record<string, any> = { ...target };
      for (const key of Object.keys(source)) {
        if (merged[key]) {
          merged[key] = this.deepMerge(merged[key], source[key]);
        } else {
          merged[key] = source[key];
        }
      }
      return merged;
    }

    return source; // Primitive or different types
  }


  async removeBannerByAdmin(
    eventId: string,
    bannerUrl: string,
    adminId: string,
  ): Promise<AddOnDocument> {
    const event = await this.addOnModel.findById(eventId);
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
      const index = event.pendingChanges.banner.findIndex((url) => url === bannerUrl);
      if (index !== -1) {
        event.pendingChanges.banner.splice(index, 1);
        removedFrom = 'pending';
        event.markModified('pendingChanges.banner');
      }
    }

    // --- 3️⃣ If still not found, throw error ---
    if (!removedFrom) {
      throw new NotFoundException('Banner not found in event or pending changes');
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


  async updatePendingAddOnByAdmin(
    addOnId: string,
    dto: UpdatePendingAddOnDto,
    adminId: Types.ObjectId,
  ) {
    const addOn = await this.addOnModel.findById(addOnId);
    if (!addOn) throw new NotFoundException('Add-on not found');

    // Initialize pendingChanges if not exists
    if (!addOn.pendingChanges) {
      addOn.pendingChanges = {};
    }

    // Only update pendingChanges fields from DTO
    const allowedFields = ['name', 'description', 'category', 'banner', 'tiers', 'cityOfOperation'];
    for (const key of allowedFields) {
      if (dto[key] !== undefined) {
        addOn.pendingChanges[key] = dto[key];
      }
    }


    await this.addonHistoryService.recordHistory({
      addOnId: addOn._id,
      updatedBy: adminId,
      updatedByRole: 'admin', // 'admin' or 'vendor'
      oldData: addOn, // You might want to fetch the old data before saving
      newData: dto,
      updateStatus: 'edit_by_admin',
      comment: 'Addon updated by admin',
    });
    // Mark pendingChanges as modified so Mongoose saves nested fields
    addOn.markModified('pendingChanges');

    // Optionally, set updateStatus to pending
    addOn.updateStatus = 'pending';


    await addOn.save();

    return addOn;
  }

  private formatAddOnForEdit(addOn: any) {
    console.log("Formatting add-on for edit:", addOn);

    return {
      _id: addOn._id,
      name: addOn.name,
      banner: addOn.banner || [],
      description: addOn.description || '',
      exclusion: addOn.exclusion || '',
      category:
        typeof addOn.category === 'object' && addOn.category?._id
          ? {
            _id: addOn.category._id.toString(),
            name: addOn.category.name || '',
          }
          : addOn.category?.toString() || null, // fallback if only ObjectId
      tiers: addOn.tiers || [],
      tags: addOn.tags || '',
      price: addOn.price || 0,
      maxBookingsPerDay: addOn.maxBookingsPerDay || 1,
      cityOfOperation: addOn.cityOfOperation,
      duration: addOn.duration || '',
      maxQuantity: addOn.maxQuantity || 1,
      isActive: addOn.isActive ?? true,
      popular: addOn.popular ?? false,
      updateStatus: addOn.updateStatus,
      isVerify: addOn.isVerify,
    };
  }


  // addOn.service.ts
  // async getAddOnForEdit(addOnId: string, vendorId: string) {
  //   const addOn = await this.addOnModel
  //     .findOne({ _id: addOnId, createdBy: vendorId })
  //     .lean();

  //   if (!addOn) throw new NotFoundException('Add-on not found');

  //   // 🟢 Case 1: Approved & Verified (show live)
  //   if (addOn.isVerify && addOn.updateStatus === 'approved') {
  //     return this.formatAddOnForEdit(addOn);
  //   }

  //   // 🟡 Case 2: Pending (show pendingChanges)
  //   if (!addOn.isVerify && addOn.updateStatus === 'pending') {
  //     const pending = addOn.pendingChanges || {};
  //     return this.formatAddOnForEdit({
  //       ...addOn,
  //       ...pending,
  //     });
  //   }

  //   // 🔴 Case 3: Rejected → show from history
  //   // if (!addOn.isVerify && addOn.updateStatus === 'rejected') {
  //   //   const lastHistory = await this.addonHistoryService.getHistory(addOnId)


  //   //   if (!lastHistory) throw new NotFoundException('No rejected history found');

  //   //   // return this.formatAddOnForEdit(lastHistory.changes || lastHistory);
  //   // }

  //   // Default fallback
  //   return this.formatAddOnForEdit(addOn);
  // }
  async getAddOnForEdit(addOnId: string, vendorId: string) {
    const addOnObjectId = new Types.ObjectId(addOnId);
    const vendorObjectId = new Types.ObjectId(vendorId);
    console.log("Fetching add-on for edit:", { addOnId, vendorId });
    const pipeline: PipelineStage[] = [
      {
        $match: {
          _id: addOnObjectId,
          createdBy: vendorObjectId, // 🔒 Only the creator vendor can see
        },
      },

      // Join with related collections
      ...lookupAndUnwind('category', 'categories', 'category', { name: 1, label: 1 }),
      ...lookupAndUnwind('createdBy', 'vendors', 'createdBy', {
        businessName: 1,
        email: 1,
      }),
      ...lookupAndUnwind(
        'pendingChanges.category',
        'categories',
        'pendingChanges.category',
        { name: 1, label: 1 },
      ),

      // Only project relevant fields
      {
        $project: {
          name: 1,
          description: 1,
          banner: 1,
          tags: 1,
          category: 1,
          updateReason: 1,
          updateStatus: 1,
          cityOfOperation: 1,
          exclusion: 1,

          tiers: 1,
          isActive: 1,
          isVerify: 1,
          maxQuantity: 1,
          maxBookingsPerDay: 1,
          pendingChanges: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    let [addOn] = await this.addOnModel.aggregate(pipeline);
    console.log("addOn fetched for edit", addOn);
    // 🟢 CASE 1: Approved and verified
    if (addOn?.isVerify && addOn.updateStatus === 'approve') {
      console.log("Case 1: Approved and verified data ", addOn);
      return this.formatAddOnForEdit(addOn);

    }

    // 🟡 CASE 2: Pending verification → show pendingChanges
    if (!addOn.isVerify && addOn.updateStatus === 'pending') {
      const pending = addOn.pendingChanges || {};
      return this.formatAddOnForEdit({
        ...addOn,
        ...pending,
      });
    }

    // 🔴 CASE 3: Rejected → fetch from history
    if (!addOn.isVerify && addOn.updateStatus === 'rejected') {
      let convertIntoArray = addOnId.split(" ");

      const lastHistory = await this.addonHistoryService.getLastRejectedChanges(convertIntoArray);
      if (!lastHistory) throw new NotFoundException('No history found for this Add-on');

      console.log("lastHistory:", lastHistory);

      // Extract the first key
      const historyKey = Object.keys(lastHistory)[0];
      const historyData = lastHistory[historyKey];

      if (!historyData || !historyData.lastRejectedChanges) {
        throw new NotFoundException('Rejected changes not found for this Add-on');
      }

      const formatData = extractNewValues(historyData.lastRejectedChanges);
      console.log('formatData for rejected add-on:', formatData);

      return this.formatAddOnForEdit(formatData);
    }


    // Default fallback
    return this.formatAddOnForEdit(addOn);
  }











































  async createByVendor(dto: CreateAddOnDto & { createdBy: string }) {
    const addOn = new this.addOnModel({
      ...dto,
      registrationStatus: 'draft',
      updateStatus: 'pending',
      isVerify: false,
      pendingChanges: { ...dto, updatedAt: new Date(), updatedBy: dto.createdBy },
      createdBy: dto.createdBy,
    });
    return addOn.save();
  }

  async update(id: string, dto: UpdateAddOnDto) {
    const addOn = await this.addOnModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!addOn) throw new NotFoundException('Add-on not found');
    return addOn;
  }

  async updateByVendor(id: string, dto: UpdateAddOnDto, vendorId: string) {
    // 1️⃣ Find the Add-on
    const addOn = await this.addOnModel.findById(id);
    if (!addOn) {
      throw new NotFoundException('Add-on not found');
    }

    // 2️⃣ Verify ownership
    if (String(addOn.createdBy) !== String(vendorId)) {
      throw new BadRequestException('Not your add-on');
    }

    // 3️⃣ Normalize category and vendorId types
    const updatedDto = { ...dto };

    // 🧩 If category comes as string, convert to ObjectId
    if (updatedDto.category && typeof updatedDto.category === 'string') {
      // updatedDto.category = new Types.ObjectId(updatedDto.category);
    }

    // 🧩 Ensure updatedBy is stored as ObjectId
    const updatedById = new Types.ObjectId(vendorId);

    // 4️⃣ Merge pending changes safely
    // addOns.pendingChanges = {
    //   ...addOn.pendingChanges,
    //   ...updatedDto,
    //   updatedAt: new Date(),
    //   updatedBy: updatedById,
    // };

    // 5️⃣ Set status to pending
    addOn.updateStatus = 'pending';

    // 6️⃣ Save document
    await addOn.save();

    return addOn;
  }



  async findAll(options: any = {}) {
    const { page = 1, limit = 10, sortBy, populate, ...filter } = options;

    if (filter.addOns) {

      const addOnsArray = JSON.parse(filter.addOns);
      console.log("addOnsArray", addOnsArray)
      if (addOnsArray.length > 0) {
        const ids = addOnsArray.map((id) => new Types.ObjectId(id));
        console.log("ids", ids)
        // 🟢 Fetch categories and get their names
        const categories = await this.categoryModel.find(
          { _id: { $in: ids } }, // use ids instead of raw array
          { name: 1 }, // only fetch name field
        );
        console.log("categories", categories)

        const categoryNames = categories.map((c) => c.name);
        filter.category = { $in: categoryNames };
      }

      delete filter.addOns;
    }

    if (filter.active !== undefined) filter.active = filter.active;
    if (filter.popular !== undefined) filter.popular = filter.popular;

    return (this.addOnModel as any).paginate(filter, {
      page: Number(page),
      limit: Number(limit),
      sortBy,
      populate: 'createdBy:name email mobile firstName lastName ',
    });
  }
  async listAddonsForPublic(options: any = {}) {
    const { page = 1, limit = 10, sortBy, populate, date, ...filter } = options;

    // 1️⃣ Handle addOns array filter (categories)


    if (filter.categoryId || filter.addOns) {
      try {
        // Prefer categoryId, else fallback to addOns
        const rawIds = (filter.categoryId || filter.addOns)
          .split(',')
          .map((id: string) => id.trim())
          .filter(Boolean);
        filter.category = { $in: rawIds };

        // if (rawIds.length > 0) {
        //   const ids = rawIds.map(id => new Types.ObjectId(id));

        // const categories = await this.categoryModel.find(
        //   { _id: { $in: ids } },
        //   { name: 1 }
        // );

        // const categoryNames = categories.map(c => c.name);

        // if (categoryNames.length > 0) {
        //   filter.category = { $in: categoryNames };
        // }

      } catch (err) {
        console.warn('Invalid category/addOns filter input', err);
      }

      // Always clean up these fields
      delete filter.categoryId;
      delete filter.addOns;
    }

    // if (filter.addOns) {
    //   try {

    //     const addOnsArray = filter.addOns.split(',').map((id: string) => id.trim());
    //     if (addOnsArray.length > 0) {
    //       const ids = addOnsArray.map(id => new Types.ObjectId(id));
    //       const categories = await this.categoryModel.find({ _id: { $in: ids } }, { name: 1 });
    //       const categoryNames = categories.map(c => c.name);
    //       filter.category = { $in: categoryNames };
    //     }
    //   } catch (err) {
    //     console.warn('Invalid addOns filter JSON', err);
    //   }
    //   delete filter.addOns;
    // }

    // if (filter.categoryId) {
    //    try {

    //     const addOnsArray = filter.categoryId.split(',').map((id: string) => id.trim());
    //     if (addOnsArray.length > 0) {
    //       const ids = addOnsArray.map(id => new Types.ObjectId(id));
    //       const categories = await this.categoryModel.find({ _id: { $in: ids } }, { name: 1 });
    //       const categoryNames = categories.map(c => c.name);
    //       filter.category = { $in: categoryNames };
    //     }
    //   } catch (err) {
    //     console.warn('Invalid addOns filter JSON', err);
    //   }
    //   delete filter.categoryId;
    // }


    console.log("filter in listAddonsForPublic", filter);
    // 2️⃣ Base addOn query
    let query = this.addOnModel.find({
      ...filter,
      isActive: true,
      isVerify: true,
    }).select('name price banner category cityOfOperation description createdBy');

    // 3️⃣ Optional populate
    if (populate) query = query.populate(populate);

    let addons = await query.lean().exec();

    // 4️⃣ Filter by vendor availability if date is provided
    if (date) {
      const targetDate = new Date(date);

      const vendorIds = [...new Set(
        addons.map(a => a.createdBy?.toString()).filter((id): id is string => !!id)
      )];

      if (vendorIds.length > 0) {
        const vendorAvailabilities = await this.vendorAvailabilityService.getAvailabilitiesForVendors(vendorIds);

        const availabilityMap = new Map<string, any>();
        vendorAvailabilities.forEach(avail => {
          if (avail.vendorId) availabilityMap.set(avail.vendorId.toString(), avail);
        });

        addons = addons.filter(addon => {
          if (!addon.createdBy) return false;
          const availability = availabilityMap.get(addon.createdBy.toString());
          return this.vendorAvailabilityService.isVendorAvailableOnDate(targetDate, availability);
        });
      } else {
        console.log('No vendor IDs found, skipping availability filter');
      }
    }

    // 5️⃣ Optional sorting
    if (sortBy) {
      const [field, order] = sortBy.split(':');
      addons.sort((a: any, b: any) => {
        const aVal = a[field] ?? 0;
        const bVal = b[field] ?? 0;
        if (order === 'desc') return aVal < bVal ? 1 : -1;
        return aVal > bVal ? 1 : -1;
      });
    }

    // 6️⃣ Manual pagination
    const totalDocs = addons.length;
    const startIndex = (page - 1) * limit;
    const paginatedAddons = addons.slice(startIndex, startIndex + Number(limit));

    return {
      results: paginatedAddons,
      totalDocs,
      totalPages: Math.ceil(totalDocs / limit),
      page: Number(page),
      limit: Number(limit),
    };
  }



  async activeAddOns(id: string) {
    const addOn = await this.addOnModel.findById(id);
    if (!addOn) {
      throw new NotFoundException('Add-on not found');
    }
    addOn.isActive = !addOn.isActive; // Toggle active status
    return addOn.save();
  }
  async getVendorAddOns(vendorId: string) {
    return this.addOnModel.find({ createdBy: vendorId });
  }

  async getVendorPendingAddOns(vendorId: string) {
    return this.addOnModel.find({ createdBy: vendorId, updateStatus: 'pending' });
  }





}
