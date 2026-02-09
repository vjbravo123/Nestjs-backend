import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Coupon, CouponDocument } from './coupon.schema';
import { CreateCouponDto } from './dto/create-coupon.dto';

interface FindUserCouponParams {
    userId: string;
    birthdayEvent?: string;
    code?: string;
}







@Injectable()
export class CouponService {
    constructor(
        @InjectModel(Coupon.name) private readonly couponModel: Model<Coupon>,
    ) { }

    async create(dto: CreateCouponDto): Promise<Coupon> {
        const exists = await this.couponModel.findOne({ code: dto.code });
        if (exists) {
            throw new BadRequestException('Coupon code already exists');
        }
        const coupon = new this.couponModel(dto);
        return coupon.save();
    }
    async findAll(options: any = {}) {
        const {
            page = 1,
            limit = 10,
            sortBy,
            populate,
            birthdayEvent,   // destructured properly
            userId,
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

        const andConditions: any[] = [];

        // 🟢 Event-wise filtering
        if (birthdayEvent) {
            andConditions.push({
                $or: [
                    { isGlobal: true }, // global coupons
                    {
                        $and: [
                            // ✅ include check
                            {
                                $or: [
                                    { includeBirthDayEvents: { $size: 0 } },
                                    { includeBirthDayEvents: { $exists: false } },
                                    { includeBirthDayEvents: { $in: [birthdayEvent] } },
                                ],
                            },
                            // ✅ exclude check
                            {
                                $or: [
                                    { excludeBirthDayEvents: { $size: 0 } },
                                    { excludeBirthDayEvents: { $exists: false } },
                                    { excludeBirthDayEvents: { $nin: [birthdayEvent] } },
                                ],
                            },
                        ],
                    },
                ],
            });
        }

        // 🟢 User-wise filtering
        if (userId) {
            andConditions.push({
                $or: [
                    { assignedUsers: { $size: 0 } },
                    { assignedUsers: { $exists: false } },
                    { assignedUsers: { $in: [userId] } },
                ],
            });
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        // console.log('final filter =>', JSON.stringify(filter, null, 2));

        return (this.couponModel as any).paginate(filter, {
            page: Number(page),
            limit: Number(limit),
            sort: sortBy,
            populate,
        });
    }
    async findCouponForUser({
        userId,
        birthdayEvent,
        code,
    }: FindUserCouponParams): Promise<CouponDocument[]> {

        console.log("userId, birthdayEvent, code", userId, birthdayEvent, code);
        const now = new Date();

        // 🟢 Base filter (only active & non-expired)
        const baseFilter: Record<string, any> = {
            isActive: true,
            expiryDate: { $gte: now },
        };

        const andConditions: Record<string, any>[] = [];

        // 🟢 If user entered a coupon code, match that first
        if (code) {
            baseFilter.code = { $regex: `^${code}$`, $options: 'i' }; // case-insensitive exact match

            andConditions.push({
                $or: [
                    { isGlobal: true },
                    {
                        $and: [
                            {
                                $or: [
                                    { assignedUsers: { $exists: false } },
                                    { assignedUsers: { $size: 0 } },
                                    { assignedUsers: { $in: [userId] } },
                                ],
                            },
                            {
                                $or: [
                                    { includeBirthDayEvents: { $exists: false } },
                                    { includeBirthDayEvents: { $size: 0 } },
                                    { includeBirthDayEvents: { $in: [birthdayEvent] } },
                                ],
                            },
                            {
                                $or: [
                                    { excludeBirthDayEvents: { $exists: false } },
                                    { excludeBirthDayEvents: { $size: 0 } },
                                    { excludeBirthDayEvents: { $nin: [birthdayEvent] } },
                                ],
                            },
                        ],
                    },
                ],
            });
        }
        // 🟢 Otherwise (no code provided) — fetch all coupons valid for user & event
        else {
            andConditions.push({
                $or: [
                    { isGlobal: true },
                    {
                        $and: [
                            {
                                $or: [
                                    { assignedUsers: { $exists: false } },
                                    { assignedUsers: { $size: 0 } },
                                    { assignedUsers: { $in: [userId] } },
                                ],
                            },
                            {
                                $or: [
                                    { includeBirthDayEvents: { $exists: false } },
                                    { includeBirthDayEvents: { $size: 0 } },
                                    { includeBirthDayEvents: { $in: [birthdayEvent] } },
                                ],
                            },
                            {
                                $or: [
                                    { excludeBirthDayEvents: { $exists: false } },
                                    { excludeBirthDayEvents: { $size: 0 } },
                                    { excludeBirthDayEvents: { $nin: [birthdayEvent] } },
                                ],
                            },
                        ],
                    },
                ],
            });
        }

        baseFilter.$and = andConditions;

        // 🟢 Execute query
        const coupons = await this.couponModel.find(baseFilter).select('-__v -createdAt -updatedAt -includeBirthDayEvents -excludeBirthDayEvents -excludeEvents -includeEvents -assignedUsers').exec();

        return coupons;
    }




    async toggleActive(couponId: string) {
        const coupon = await this.couponModel.findById(couponId);
        if (!coupon) {
            throw new Error('Coupon not found');
        }
        coupon.isActive = !coupon.isActive;
        await coupon.save();
        return coupon;
    }


    async findByCode(code: string): Promise<Coupon | null> {
        return this.couponModel.findOne({ code, isActive: true }).exec();
    }
}
