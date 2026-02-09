import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  VendorAvailability,
  VendorAvailabilityDocument,
} from './vendor-availability.schema';

import { AvailabilityCell } from './interfaces/availability.interface';
import { normalizeToDateOnly } from './availability.utils';
@Injectable()
export class VendorAvailabilityService {
  constructor(
    @InjectModel(VendorAvailability.name)
    private readonly availabilityModel: Model<VendorAvailabilityDocument>,
  ) { }

  // ✅ weekly days
  async setWeeklyAvailability(
    vendorId: Types.ObjectId,
    dto: { weeklyAvailableDays: string[] },
  ) {
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    const numericDays = dto.weeklyAvailableDays.map((d) => {
      const day = dayMap[d];
      if (day === undefined) throw new BadRequestException(`Invalid weekday: ${d}`);
      return day;
    });

    return this.availabilityModel
      .findOneAndUpdate(
        { vendorId },
        { $set: { weeklyAvailableDays: numericDays } },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
  }

  // ✅ NEW: weekly slots per day
  async setWeeklySlots(
    vendorId: Types.ObjectId,
    dto: { weeklySlots: { day: string; slots: string[] }[] },
  ) {
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    const weeklySlots = dto.weeklySlots.map((item) => {
      const dayNum = dayMap[item.day];
      if (dayNum === undefined) {
        throw new BadRequestException(`Invalid weekday: ${item.day}`);
      }
      return {
        day: dayNum,
        slots: item.slots || [],
      };
    });

    return this.availabilityModel
      .findOneAndUpdate(
        { vendorId },
        { $set: { weeklySlots } },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
  }

  // ✅ override (now includes slots)
  async addOverride(
    vendorId: Types.ObjectId,
    dto: { date: string; isAvailable: boolean; reason?: string; slots?: string[] },
  ) {
    const dateOnly = normalizeToDateOnly(dto.date);
    const nextDay = new Date(dateOnly);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    // ✅ 1) remove existing override for that date
    await this.availabilityModel.updateOne(
      { vendorId },
      {
        $pull: {
          overrides: { date: { $gte: dateOnly, $lt: nextDay } },
        },
      },
      { upsert: true },
    );

    // ✅ 2) insert fresh override
    return this.availabilityModel
      .findOneAndUpdate(
        { vendorId },
        {
          $push: {
            overrides: {
              date: dateOnly,
              isAvailable: dto.isAvailable,
              reason: dto.reason || undefined,
              slots: dto.isAvailable ? (dto.slots || []) : [],
            },
          },
        },
        { new: true, upsert: true },
      )
      .lean()
      .exec();
  }


  // ✅ range (now includes slots)
  async addRange(
    vendorId: Types.ObjectId,
    dto: {
      startDate: string;
      endDate: string;
      isAvailable: boolean;
      reason?: string;
      slots?: string[];
    },
  ) {
    const startDate = normalizeToDateOnly(dto.startDate);
    const endDate = normalizeToDateOnly(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('end date must be greater than startDate date.');
    }

    const existing = await this.availabilityModel.findOne({ vendorId }).lean().exec();

    if (!existing) {
      return this.availabilityModel.create({
        vendorId,
        ranges: [
          {
            startDate,
            endDate,
            isAvailable: dto.isAvailable,
            reason: dto.reason || undefined,
            slots: dto.isAvailable ? (dto.slots || []) : [],
          },
        ],
      });
    }

    const ranges = existing.ranges ?? [];

    const exactExists = ranges.some(
      (r) =>
        r.startDate.getTime() === startDate.getTime() &&
        r.endDate.getTime() === endDate.getTime() &&
        r.isAvailable === dto.isAvailable,
    );

    if (exactExists) {
      throw new BadRequestException('This date range already exists and cannot be added again.');
    }

    const overlaps = ranges.some(
      (r) =>
        !(endDate < r.startDate || startDate > r.endDate) &&
        r.isAvailable !== dto.isAvailable,
    );

    if (overlaps) {
      throw new BadRequestException(
        'Overlapping date range with conflicting availability already exists.',
      );
    }

    return this.availabilityModel
      .findOneAndUpdate(
        { vendorId },
        {
          $push: {
            ranges: {
              startDate,
              endDate,
              isAvailable: dto.isAvailable,
              reason: dto.reason || undefined,
              slots: dto.isAvailable ? (dto.slots || []) : [],
            },
          },
        },
        { new: true, upsert: true },
      )
      .lean()
      .exec();
  }

  // ✅ delete override
  async deleteOverride(vendorId: Types.ObjectId, overrideId: string) {
    return this.availabilityModel
      .findOneAndUpdate(
        { vendorId },
        { $pull: { overrides: { _id: new Types.ObjectId(overrideId) } } },
        { new: true },
      )
      .exec();
  }

  // ✅ delete range
  async deleteRange(vendorId: Types.ObjectId, rangeId: string) {
    const rangeObjId = new Types.ObjectId(rangeId);

    return this.availabilityModel
      .findOneAndUpdate(
        { vendorId },
        { $pull: { ranges: { _id: rangeObjId } } },
        { new: true },
      )
      .exec();
  }

  async getVendorAvailability(vendorId: Types.ObjectId) {
    const availability = await this.availabilityModel.findOne({ vendorId }).lean().exec();
    if (!availability) throw new NotFoundException('Vendor availability not found.');

    const dayMap: Record<number, string> = {
      0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
    };

    const weeklyNames =
      availability.weeklyAvailableDays?.map((d: number) => dayMap[d]) || [];

    const formatDate = (date: Date | string) => new Date(date).toISOString().split('T')[0];

    const overrides = availability.overrides?.map((o: any) => ({
      ...o,
      date: formatDate(o.date),
    })) || [];

    const ranges = availability.ranges?.map((r: any) => ({
      ...r,
      startDate: formatDate(r.startDate),
      endDate: formatDate(r.endDate),
    })) || [];

    return {
      ...availability,
      weeklyAvailableDays: weeklyNames,
      overrides,
      ranges,
    };
  }





  async checkAvailability(vendorId: Types.ObjectId, dateStr: string) {
    const date = normalizeToDateOnly(dateStr);

    const record = await this.availabilityModel
      .findOne({ vendorId })
      .lean()
      .exec();

    if (!record) {
      return {
        date,
        isAvailable: false,
        source: 'default',
        reason: 'No availability settings found for vendor.',
        slots: [],
      };
    }

    const weekday = date.getUTCDay(); // 0=Sun..6=Sat

    // ✅ 1) Override (highest priority)
    const override = record.overrides?.find(
      (o) => normalizeToDateOnly(o.date).getTime() === date.getTime(),
    );

    if (override) {
      return {
        date,
        isAvailable: override.isAvailable,
        source: 'override',
        reason: override.reason || null,
        slots: override.isAvailable ? (override.slots || []) : [],
      };
    }

    // ✅ 2) Range (second priority)
    const range = record.ranges?.find(
      (r) =>
        date >= normalizeToDateOnly(r.startDate) &&
        date <= normalizeToDateOnly(r.endDate),
    );

    if (range) {
      return {
        date,
        isAvailable: range.isAvailable,
        source: 'range',
        reason: range.reason || null,
        slots: range.isAvailable ? (range.slots || []) : [],
      };
    }

    // ✅ 3) Weekly
    const isWeeklyAvailable = record.weeklyAvailableDays?.includes(weekday);

    if (!isWeeklyAvailable) {
      return {
        date,
        isAvailable: false,
        source: 'weekly',
        reason: 'Vendor is unavailable for this weekday.',
        slots: [],
      };
    }

    const weeklySlotEntry = record.weeklySlots?.find((w) => w.day === weekday);

    return {
      date,
      isAvailable: true,
      source: 'weekly',
      reason: null,
      slots: weeklySlotEntry?.slots || [],
    };
  }



  async getAvailabilitiesForVendors(vendorIds: string[]) {
    const cleanedVendorIds = (vendorIds || [])
      .map((id) => id?.toString().trim())
      .filter(Boolean);

    if (cleanedVendorIds.length === 0) return [];

    const objectIds = cleanedVendorIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (objectIds.length === 0) return [];

    return this.availabilityModel
      .find({ vendorId: { $in: objectIds } })
      .lean()
      .exec();
  }



  isVendorAvailableOnDate(date: Date, availability?: VendorAvailability | any): boolean {
    if (!availability) return false;

    const d = normalizeToDateOnly(date);

    // 1) Override first
    const override = availability.overrides?.find(
      (o: any) => normalizeToDateOnly(o.date).getTime() === d.getTime(),
    );
    if (override) return !!override.isAvailable;

    // 2) Range
    const range = availability.ranges?.find((r: any) => {
      const s = normalizeToDateOnly(r.startDate).getTime();
      const e = normalizeToDateOnly(r.endDate).getTime();
      return d.getTime() >= s && d.getTime() <= e;
    });
    if (range) return !!range.isAvailable;

    // 3) Weekly fallback
    const weekday = d.getUTCDay();
    return (availability.weeklyAvailableDays || []).includes(weekday);
  }

  checkVendorAvailabilityLocal(availability: any, date: Date): boolean {
    // ✅ default allow if not configured
    if (!availability) return true;

    const d = normalizeToDateOnly(date);

    // 1️⃣ override
    const override = availability.overrides?.find(
      (o: any) => normalizeToDateOnly(o.date).getTime() === d.getTime(),
    );
    if (override) return !!override.isAvailable;

    // 2️⃣ range
    const range = availability.ranges?.find((r: any) => {
      const s = normalizeToDateOnly(r.startDate).getTime();
      const e = normalizeToDateOnly(r.endDate).getTime();
      return d.getTime() >= s && d.getTime() <= e;
    });
    if (range) return !!range.isAvailable;

    // 3️⃣ weekly
    const weekday = d.getUTCDay();
    return (availability.weeklyAvailableDays || []).includes(weekday);
  }

  // your other functions (checkAvailability, monthly calendar etc.) can stay same
}
