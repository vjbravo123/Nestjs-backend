import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor, VendorDocument } from './vendor.schema';
import { Order, OrderDocument } from '../order/order.schema';
import { UtilityService } from '../../services/utility.service';
import { CreateVendorDtoStep1 } from '../auth/dto/create-vendor.dto';
import { mergeWith, isArray } from 'lodash';
import { lookupAndUnwind } from '../../common/utils/mongoose-lookup.util';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
@Injectable()
export class VendorService {
  constructor(
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly eventEmitter: EventEmitter2, // ✅ CORRECT
    private readonly utilityService: UtilityService,
  ) { }

  async getVendorByEmail(email: string): Promise<VendorDocument | null> {
    return this.vendorModel.findOne({ email }).exec();
  }
  async findVendorById(id: string) {
    return this.vendorModel.findById(id).exec();
  }
  async getVendorById(vendorId: string): Promise<VendorDocument> {


    const vendor = await this.vendorModel.findById(vendorId).exec();
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }
    return vendor;
  }
  async updateActive(vendorId: string) {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) {
      throw new Error('Event not found');
    }
    vendor.isActive = !vendor.isActive;
    await vendor.save();
    return vendor;
  }
  async updateVendorStatus(vendorId: string, data: object = {}) {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) {
      throw new Error('Event not found');
    }
    vendor.status = data['status'] || vendor?.status;
    vendor.reason = data['reason'] || vendor?.reason || undefined;
    await vendor.save();
    return vendor;
  }
  async createVendor(vendorData: Partial<Vendor>): Promise<VendorDocument> {
    const newVendor = new this.vendorModel({
      ...vendorData,
      registrationStatus: 'draft',
    });
    return await newVendor.save();
  }



  async updateVendorDto(
    vendorId: string,
    updateData: Partial<Vendor>,
  ): Promise<VendorDocument> {

    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    console.log('vendor data with pending', vendor);
    console.log('update data from dto', updateData);

    // 1️⃣ Ensure pendingChanges exists
    if (!vendor.pendingChanges) {
      vendor.pendingChanges = {};
    }

    // 2️⃣ Store ALL incoming data in pendingChanges ONLY
    Object.assign(vendor.pendingChanges, updateData, {
      updatedAt: new Date(),
    });

    // 🔴 IMPORTANT: tell mongoose this field changed
    vendor.markModified('pendingChanges');

    // 3️⃣ Workflow metadata (ROOT FIELDS)
    vendor.profileUpdateStatus = 'pending';
    vendor.profileUpdateReason = undefined;
    vendor.registrationStatus = updateData.registrationStatus

    // ❌ DO NOT update registrationStatus here
    // vendor.registrationStatus = updateData.registrationStatus;

    if (updateData.registrationStatus == 'complete') {
      console.log("now partner.application.received event emit ")
      this.eventEmitter.emit('partner.application.received', {
        partnerId: vendor.id.toString(),

        // 👤 Partner Details
        businessName: vendor.pendingChanges.businessName,
        partnerEmail: vendor.email,
        partnerPhone: vendor.mobile,

        // 🏢 Business Information
        businessType: vendor.pendingChanges.businessType,
        city: vendor.pendingChanges.city,

        // 📅 Registration Date
        appliedDate: new Date(),
      });
    }

    console.log('update vendor after changes', vendor);

    return await vendor.save();
  }

  async findAll(options: any = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy,
      populate = "servicesOffered:name;pendingChanges.servicesOffered",

      ...filter
    } = options;

    // 🟢 Handle boolean filter (isActive)
    if (filter.isActive !== undefined) {
      filter.isActive = filter.isActive === 'true' || filter.isActive === true;
    }

    // 🟢 Handle expiry filter
    if (filter.isExpire === 'false') {
      filter.expiryDate = { $gte: new Date() };
      delete filter.isExpire;
    }

    // 🟢 Convert userLimit to number
    if (filter.userLimit) {
      filter.userLimit = Number(filter.userLimit);
    }
    if (filter.category) {
      console.log("filter.category", filter.category)

      //
      filter.servicesOffered = { $in: filter.category.split(',') };
      delete filter.category;
    }
    if (filter.search) {
      const raw = String(filter.search).trim();
      const searchRegex = new RegExp(raw, 'i');

      const or: any[] = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];

      if (/^\d+$/.test(raw)) {
        // partial match on numeric mobile: use $expr + $regexMatch on stringified mobile
        or.push({
          $expr: {
            $regexMatch: {
              input: { $toString: "$mobile" },
              regex: raw,
              options: "i",
            },
          },
        });
      }

      filter.$or = or;
      delete filter.search;
    }


    console.log('filter in vendor service', filter);
    return (this.vendorModel as any).paginate(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: sortBy,
      populate,
    });
  }
  async listOfVendorForPublic(options: any = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy,
      populate,

      ...filter
    } = options;

    // 🟢 Handle boolean filter (isActive)
    if (filter.isActive !== undefined) {
      filter.isActive = filter.isActive === 'true' || filter.isActive === true;
    }

    // 🟢 Handle expiry filter
    if (filter.isExpire === 'false') {
      filter.expiryDate = { $gte: new Date() };
      delete filter.isExpire;
    }

    // 🟢 Convert userLimit to number
    if (filter.userLimit) {
      filter.userLimit = Number(filter.userLimit);
    }
    if (filter.isVerify !== undefined) {
      filter.isVerified = filter.isVerify === 'true' || filter.isVerify === true;
      delete filter.isVerify
    }
    if (filter.search) {
      const raw = String(filter.search).trim();
      const searchRegex = new RegExp(raw, 'i');

      const or: any[] = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];

      if (/^\d+$/.test(raw)) {
        // partial match on numeric mobile: use $expr + $regexMatch on stringified mobile
        or.push({
          $expr: {
            $regexMatch: {
              input: { $toString: "$mobile" },
              regex: raw,
              options: "i",
            },
          },
        });
      }

      filter.$or = or;
      delete filter.search;
    }
    return (this.vendorModel as any).paginate(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: sortBy,
      populate,
      select: '-password -pendingChanges -tokenVersion -createdBy -updatedBy -__v -consent -agreeToTerms -isEmailVerify -isMobileVerify -email -mobile -role -status -registrationStatus -gstin -businessAddress -zip -servicesOffered',
    });
  }
  async findVendorByMobile(mobile: number): Promise<VendorDocument | null> {
    return this.vendorModel.findOne({ mobile }).select('+password').exec();
  }
  async submitProfileUpdate(vendorId: string, updateData: any, updatedBy: string): Promise<VendorDocument> {
    const vendor = await this.vendorModel.findById(vendorId)
    if (!vendor) {
      throw new NotFoundException("Vendor not found")
    }

    // Ensure pendingChanges exists
    vendor.pendingChanges = vendor.pendingChanges || {}

    // Define allowed fields for profile updates
    const allowedFields = [
      "businessName",
      "businessType",
      "subBusinessType",
      "experience",
      "city",
      "state",
      "zip",
      "businessAddress",
      "businessDescription",
      "gstin",
      "displayImages",
      "websiteUrl",
      "socialMediaLinks",
      "servicesOffered",
    ]

    vendor.pendingChanges = vendor.pendingChanges || {}
    const pending = vendor.pendingChanges

    allowedFields.forEach((field) => {
      if (field in updateData && updateData[field] !== undefined) {
        pending[field] = updateData[field]
      }
    })

    // pending.updatedAt = new Date()
    // pending.updatedBy = updatedBy

    // Always update metadata
    vendor.pendingChanges.updatedAt = new Date()
    vendor.pendingChanges.updatedBy = updatedBy

    // Set status to pending if there are actual changes
    vendor.profileUpdateStatus = "pending"

    // Important: Tell mongoose this nested object changed
    vendor.markModified("pendingChanges")

    return await vendor.save()
  }


  async approveProfileUpdate(
    vendorId: string,
    adminId: string,
    reason?: string
  ): Promise<VendorDocument> {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (vendor.registrationStatus !== 'complete') {
      throw new UnprocessableEntityException(
        '⛔ Approval denied: Vendor steps are not completed',
      );
    }

    if (!vendor.pendingChanges) {
      throw new NotFoundException('No pending changes found');
    }

    // Apply pending changes to main profile
    const { updatedAt, updatedBy, ...changesToApply } = vendor.pendingChanges;
    Object.assign(vendor, changesToApply);


    vendor.pendingChanges = undefined;
    vendor.profileUpdateStatus = 'approved';
    vendor.isVerified = true; // Mark as verified on first approval
    vendor.profileUpdateReason = reason;
    return await vendor.save();
  }

  async rejectProfileUpdate(
    vendorId: string,
    reason: string,
    adminId: string
  ): Promise<VendorDocument> {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (!vendor.pendingChanges) {
      throw new NotFoundException('No pending changes found');
    }

    // Clear pending changes and update status
    vendor.pendingChanges = undefined;
    vendor.profileUpdateStatus = 'rejected';
    vendor.profileUpdateReason = reason;

    return await vendor.save();
  }

  async getVendorWithPendingChanges(vendorId: string): Promise<VendorDocument> {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }
    return vendor;
  }

  async getVendorsWithPendingUpdates(options: any = {}): Promise<any> {
    const {
      page = 1,
      limit = 10,
      sortBy = '-updatedAt',
      ...filter
    } = options;

    // Filter for vendors with pending profile updates
    const query = {
      profileUpdateStatus: 'pending',
      pendingChanges: { $exists: true, $ne: null },
      ...filter
    };

    return (this.vendorModel as any).paginate(query, {
      page: Number(page),
      limit: Number(limit),
      sort: sortBy,
    });
  }

  async getVendorProfileForUser(userId: string, vendorId: string) {
    const vendor = await this.vendorModel.findById(vendorId);
    console.log('vendor for public', vendor)
    if (!vendor) throw new NotFoundException('Vendor not found');
    const booking = await this.orderModel.findOne({
      user: userId || null,
      vendor: vendorId,
      status: 'confirmed'
    });

    const hasBooked = !!booking;
    return getVendorPublicProfile(vendor, hasBooked);
  }
  async getServiceField(vendorId: string) {
    const vendor = await this.vendorModel.findById(vendorId).populate('servicesOffered').select('servicesOffered isVerified');
    console.log('vendor for public', vendor)
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor
  }



  async getVendorProfileForAdmin(userId: string, vendorId: string) {
    if (!Types.ObjectId.isValid(vendorId)) {
      throw new BadRequestException('Invalid Vendor ID');
    }

    const pipeline = [
      /* --------------------------------------------------
       * 1️⃣ Match Vendor
       * -------------------------------------------------- */
      {
        $match: {
          _id: new Types.ObjectId(vendorId),
        },
      },

      /* --------------------------------------------------
       * 2️⃣ Lookup APPROVED servicesOffered (ObjectId[])
       * -------------------------------------------------- */
      ...lookupAndUnwind(
        'servicesOffered',
        'categories',
        'servicesOffered',
        { name: 1 },
        false, // ❗ DO NOT UNWIND ARRAY
      ),

      /* --------------------------------------------------
       * 3️⃣ Lookup PENDING servicesOffered (string[] → ObjectId[])
       * -------------------------------------------------- */
      {
        $lookup: {
          from: 'categories',
          let: {
            pendingServiceIds: {
              $map: {
                input: { $ifNull: ['$pendingChanges.servicesOffered', []] },
                as: 'id',
                in: { $toObjectId: '$$id' }, // 🔥 CRITICAL FIX
              },
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', '$$pendingServiceIds'],
                },
              },
            },
            {
              $project: {
                name: 1,
              },
            },
          ],
          as: 'pendingChanges.servicesOffered',
        },
      },

      /* --------------------------------------------------
       * 4️⃣ Normalize Empty Arrays
       * -------------------------------------------------- */
      {
        $addFields: {
          servicesOffered: {
            $ifNull: ['$servicesOffered', []],
          },
          'pendingChanges.servicesOffered': {
            $ifNull: ['$pendingChanges.servicesOffered', []],
          },
        },
      },

      /* --------------------------------------------------
       * 5️⃣ Remove Sensitive Fields
       * -------------------------------------------------- */
      {
        $project: {
          password: 0,
          tokenVersion: 0,
          __v: 0,
        },
      },
    ];

    const result = await this.vendorModel.aggregate(pipeline);

    if (!result.length) {
      throw new NotFoundException('Vendor not found');
    }

    return result[0];
  }




}
function getVendorPublicProfile(vendor: VendorDocument, hasBooked: boolean) {
  if (hasBooked) {
    // ✅ After booking → show everything
    return {
      id: vendor._id,
      firstName: vendor.firstName,
      lastName: vendor.lastName,
      email: vendor.email,
      mobile: vendor.mobile,
      role: vendor.role,
      isActive: vendor.isActive,
      status: vendor.status,
      isMobileVerify: vendor.isMobileVerify,
      isEmailVerify: vendor.isEmailVerify,

      // Business Info
      businessName: vendor.businessName,
      businessType: vendor.businessType,
      subBusinessType: vendor.subBusinessType,
      experience: vendor.experience,
      businessAddress: vendor.businessAddress,
      businessDescription: vendor.businessDescription,
      city: vendor.city,
      state: vendor.state,
      zip: vendor.zip,
      gstin: vendor.gstin,
      websiteUrl: vendor.websiteUrl,

      // Media & Links
      displayImages: vendor.displayImages,
      socialMediaLinks: vendor.socialMediaLinks,

      // Services & Terms
      servicesOffered: vendor.servicesOffered,
      agreeToTerms: vendor.agreeToTerms,
      consent: vendor.consent,

      // Registration & Updates
      registrationStatus: vendor.registrationStatus,
      tokenVersion: vendor.tokenVersion,
      profileUpdateStatus: vendor.profileUpdateStatus,
      profileUpdateReason: vendor.profileUpdateReason,

      // Audit Info
      // createdAt: vendor.createdAt,
      // updatedAt: vendor.updatedAt,
    };
  }
  console.log("vendor in public ", vendor)
  // 🚫 Before booking → hide sensitive fields
  return {
    id: vendor._id,

    // Show only safe business info
    businessName: vendor.businessName,
    businessType: vendor.businessType,
    subBusinessType: vendor.subBusinessType,
    experience: vendor.experience,
    businessDescription: vendor.businessDescription,

    // Media
    displayImages: vendor.displayImages,
    socialMediaLinks: vendor.socialMediaLinks,

    // Services
    servicesOffered: vendor.servicesOffered,

    // Location (city & state ok, but no full address/zip)
    city: vendor.city,
    state: vendor.state,

    // Website ok
    websiteUrl: vendor.websiteUrl,


  };
}
