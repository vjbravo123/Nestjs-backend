import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Address, User, UserDocument } from './users.schema';
import { Vendor, VendorDocument } from '../vendor/vendor.schema';
import { Model } from 'mongoose';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Types } from 'mongoose';

const USER_UPDATE_FIELDS: (keyof UpdateUserDto)[] = ['firstName', 'lastName', 'email', 'agreeToTerms'];
const USER_SAFE_PROJECTION = 'firstName lastName email mobile role isActive isMobileVerify isEmailVerify agreeToTerms';

// Add interface for paginate plugin

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
  ) { }

  async findUserByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  async findAll(options: any = {}) {
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
              input: { $toString: '$mobile' },
              regex: raw,
              options: 'i',
            },
          },
        });
      }

      filter.$or = or;
      delete filter.search;
    }

    return (this.userModel as any).paginate(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: sortBy,
      populate,
    });
  }

  async findUserById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async createUser(userData: Partial<User>, session?: any): Promise<UserDocument> {
    const createdUser = new this.userModel(userData);
    return session ? await createdUser.save({ session }) : await createdUser.save();
  }
  async registerUserFromVendorToken(mobile: number, payload: any) {
    // You can use payload to fill other fields if needed
    const newUser = new this.userModel({
      mobile,
      firstName: payload.firstName || 'VendorUser',
      lastName: payload.lastName || '',
      role: 'user',
      isMobileVerify: true,
      isVendor: true,
      // ...other defaults
    });
    return newUser.save();
  }
  async findUserByMobile(mobile: number) {
    return this.userModel.findOne({ mobile }).select('+password').exec();
  }

  async isMobileExist(mobile: string | number): Promise<{
    user: { exists: boolean; role: 'user' };
    vendor: { exists: boolean; role: 'vendor' };
  }> {
    const mobileNumber = Number(mobile);
    console.log('mobile number in isMobileExist is', mobileNumber);

    // Query both schemas in parallel
    const [user, vendor] = await Promise.all([
      this.userModel.findOne({ mobile: mobileNumber }),
      this.vendorModel.findOne({ mobile: mobileNumber }),
    ]);

    return {
      user: {
        exists: !!user,
        role: 'user',
        // isMobileVerified: user ? user.isMobileVerify ?? null : false,
      },
      vendor: {
        exists: !!vendor,
        role: 'vendor',
        // isMobileVerified: vendor ? vendor.isMobileVerify ?? null : false,
      },
    };
  }

  async addAddress(userId: string, dto: CreateAddressDto) {
    const user = await this.userModel.findById(userId);
    if (!user) return null;

    if (user.addresses.length === 0) dto.isDefault = true;

    if (dto.isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    user.addresses.push(dto);
    await user.save();

    return user.addresses[user.addresses.length - 1];
  }

  async getAddresses(userId: string, isDefault?: string) {
    const user = await this.userModel.findById(userId).select('addresses');
    if (!user) return [];

    let addresses = user.addresses || [];
    if (isDefault !== undefined) {
      const flag = isDefault === 'true';
      addresses = addresses.filter((addr) => addr.isDefault === flag);
    }
    return addresses;
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: Partial<CreateAddressDto>,
  ) {
    // 1️⃣ If this address is being set as default
    if (dto.isDefault === true) {
      await this.userModel.updateOne(
        { _id: userId },
        { $set: { 'addresses.$[].isDefault': false } },
      );
    }

    // 2️⃣ Prepare dynamic $set object
    const setObject: Record<string, any> = {};

    for (const [key, value] of Object.entries(dto)) {
      setObject[`addresses.$.${key}`] = value;
    }

    // 3️⃣ Update the selected address
    const user = await this.userModel.findOneAndUpdate(
      { _id: userId, 'addresses._id': addressId },
      { $set: setObject },
      { new: true },
    );

    if (!user) return null;

    return user.addresses.find(
      (addr: any) => addr._id.toString() === addressId,
    );
  }


  // services/users.service.ts


  async updateUserById(
    userId: Types.ObjectId,
    dto: UpdateUserDto,
  ) {
    // 1️⃣ Build whitelist update payload
    const updatePayload: Partial<UpdateUserDto> = {};

    for (const field of USER_UPDATE_FIELDS) {
      const value = dto[field];

      if (value !== undefined) {
        updatePayload[field] = value as any;
      }
    }

    if (!Object.keys(updatePayload).length) {
      throw new BadRequestException(
        'No valid fields provided for update.',
      );
    }

    // 2️⃣ Fetch minimal existing user
    const existingUser = await this.userModel
      .findById(userId)
      .select(USER_UPDATE_FIELDS.join(' '))
      .lean();

    if (!existingUser) {
      throw new NotFoundException('User not found.');
    }

    // 3️⃣ Detect changed fields only
    const changedFields: any = {};

    for (const key of Object.keys(updatePayload)) {
      if (updatePayload[key] !== existingUser[key]) {
        changedFields[key] = updatePayload[key];
      }
    }

    if (!Object.keys(changedFields).length) {
      return existingUser; // no DB write needed
    }

    // 4️⃣ Mobile uniqueness check
    if (changedFields.mobile) {
      const mobileExists = await this.userModel.exists({
        mobile: changedFields.mobile,
        _id: { $ne: userId },
      });

      if (mobileExists) {
        throw new ConflictException(
          'Mobile number already in use.',
        );
      }
    }

    // 5️⃣ Atomic update
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: changedFields },
        {
          new: true,
          runValidators: true,
          projection: USER_SAFE_PROJECTION,
        },
      )
      .lean();

    return updatedUser;
  }

  async deleteAddress(userId: string, addressId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 1. Find the address to delete
    const addressToDelete = user.addresses.find(
      (addr: any) => addr._id.toString() === addressId,
    );
    if (!addressToDelete) {
      throw new NotFoundException('Address not found');
    }

    const wasDefault = addressToDelete.isDefault;

    // 2. Remove it
    user.addresses = user.addresses.filter(
      (addr: any) => addr._id.toString() !== addressId,
    );

    // 3. If it was default, assign another one
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    return user;
  }

  async updateActive(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('Event not found');
    }
    user.isActive = !user.isActive;
    await user.save();
    return user;
  }
  async updateUser(userId: string, updateData: Partial<User>) {
    const user = await this.userModel.findByIdAndUpdate(userId, updateData, {
      new: true,
    });
    return user;
  }
}
