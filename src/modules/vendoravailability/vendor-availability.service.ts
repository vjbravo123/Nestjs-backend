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




  // async createFullAvailability(vendorId: Types.ObjectId) {
  //   // 1️⃣ Check if already exists
  //   // const existing = await this.availabilityModel.findOne({ vendorId });
  //   // if (existing) {
  //   //   return existing; // or throw error if you don't want duplicate
  //   // }

  //   // 2️⃣ Create default weekly days (0-6)
  //   const weeklyAvailableDays = [0, 1, 2, 3, 4, 5, 6];

  //   // 3️⃣ Create default slots for each day
  //   const defaultSlots = ['breakfast', 'lunch', 'tea', 'dinner'];

  //   const weeklySlots = weeklyAvailableDays.map((day) => ({
  //     day,
  //     slots: defaultSlots,
  //   }));

  //   // 4️⃣ Create document
  //   const availability = await this.availabilityModel.create({
  //     vendorId,
  //     weeklyAvailableDays,
  //     weeklySlots,
  //     ranges: [],
  //     overrides: [],
  //   });

  //   return availability;
  // }



  //if vendor want to fully availability

  // ✅ weekly days
  async setWeeklyAvailability(
    vendorId: Types.ObjectId,
    dto: { weeklyAvailableDays: string[]; weeklySlots?: { day: string; slots: string[] }[] },
  ) {
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    // -------------------------
    // 1️⃣ weeklyAvailableDays
    // -------------------------
    const numericDays = dto.weeklyAvailableDays.map((d) => {
      const day = dayMap[d];
      if (day === undefined) {
        throw new BadRequestException(`Invalid weekday: ${d}`);
      }
      return day;
    });

    // -------------------------
    // 2️⃣ weeklySlots (optional)
    // -------------------------
    let weeklySlots: { day: number; slots: string[] }[] = [];

    if (dto.weeklySlots?.length) {
      weeklySlots = dto.weeklySlots.map((s) => {
        const dayNum = dayMap[s.day];

        if (dayNum === undefined) {
          throw new BadRequestException(`Invalid slot weekday: ${s.day}`);
        }

        return {
          day: dayNum,
          slots: s.slots || [],
        };
      });
    }

    // -------------------------
    // 3️⃣ Save
    // -------------------------
    return this.availabilityModel
      .findOneAndUpdate(
        { vendorId },
        {
          $set: {
            weeklyAvailableDays: numericDays,
            weeklySlots, // ✅ stored as [{day:1,slots:[...]}]
          },
        },
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

  async getVendorAvailability(vendorId: Types.ObjectId): Promise<any> {
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

    // Transform weeklySlots day numbers to day names
    const weeklySlots = availability.weeklySlots?.map((ws: any) => ({
      ...ws,
      day: dayMap[ws.day] || ws.day,
    })) || [];

    return {
      ...availability,
      weeklyAvailableDays: weeklyNames,
      weeklySlots,
      overrides,
      ranges,
    };
  }



  async getAvailability(vendorId: Types.ObjectId): Promise<any> {
    const availability = await this.availabilityModel.findOne({ vendorId }).lean().exec();
    if (!availability) throw new NotFoundException('Vendor availability not found.');



    return availability
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

  async checkAvailabilityForVendors(
    vendorIds: Types.ObjectId[] | string[],
    dateStr: string,
  ) {
    const date = normalizeToDateOnly(dateStr);

    const cleanedIds = (vendorIds || [])
      .map(id => id?.toString())
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    if (!cleanedIds.length) return [];

    // -----------------------------------
    // 1️⃣ Fetch all records at once
    // -----------------------------------
    const records = await this.availabilityModel
      .find({ vendorId: { $in: cleanedIds } })
      .lean()
      .exec();

    const recordMap = new Map<string, any>();
    records.forEach(r => {
      recordMap.set(r.vendorId.toString(), r);
    });

    const weekday = date.getUTCDay();

    // -----------------------------------
    // 2️⃣ Resolve per vendor (same logic)
    // -----------------------------------
    return cleanedIds.map(vendorId => {
      const record = recordMap.get(vendorId.toString());

      // default
      if (!record) {
        return {
          vendorId,
          date,
          isAvailable: false,
          source: 'default',
          reason: 'No availability settings found for vendor.',
          slots: [],
        };
      }

      // 1️⃣ Override
      const override = record.overrides?.find(
        (o: any) =>
          normalizeToDateOnly(o.date).getTime() === date.getTime(),
      );

      if (override) {
        return {
          vendorId,
          date,
          isAvailable: override.isAvailable,
          source: 'override',
          reason: override.reason || null,
          slots: override.isAvailable ? (override.slots || []) : [],
        };
      }

      // 2️⃣ Range
      const range = record.ranges?.find((r: any) =>
        date >= normalizeToDateOnly(r.startDate) &&
        date <= normalizeToDateOnly(r.endDate),
      );

      if (range) {
        return {
          vendorId,
          date,
          isAvailable: range.isAvailable,
          source: 'range',
          reason: range.reason || null,
          slots: range.isAvailable ? (range.slots || []) : [],
        };
      }

      // 3️⃣ Weekly
      const isWeeklyAvailable =
        record.weeklyAvailableDays?.includes(weekday);

      if (!isWeeklyAvailable) {
        return {
          vendorId,
          date,
          isAvailable: false,
          source: 'weekly',
          reason: 'Vendor is unavailable for this weekday.',
          slots: [],
        };
      }

      const weeklySlotEntry = record.weeklySlots?.find(
        (w: any) => w.day === weekday,
      );

      return {
        vendorId,
        date,
        isAvailable: true,
        source: 'weekly',
        reason: null,
        slots: weeklySlotEntry?.slots || [],
      };
    });
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

  // getVendorSlotsForDateLocal(availability: any, date: Date): SlotType[] {
  //   if (!availability) return [];

  //   const d = normalizeToDateOnly(date);

  //   // 1️⃣ override
  //   const override = availability.overrides?.find(
  //     (o: any) => normalizeToDateOnly(o.date).getTime() === d.getTime(),
  //   );

  //   if (override) {
  //     return override.isAvailable ? override.slots || [] : [];
  //   }

  //   // 2️⃣ range
  //   const range = availability.ranges?.find((r: any) => {
  //     const s = normalizeToDateOnly(r.startDate).getTime();
  //     const e = normalizeToDateOnly(r.endDate).getTime();
  //     return d.getTime() >= s && d.getTime() <= e;
  //   });

  //   if (range) {
  //     return range.isAvailable ? range.slots || [] : [];
  //   }

  //   // 3️⃣ weekly
  //   const weekday = d.getUTCDay();

  //   if (!(availability.weeklyAvailableDays || []).includes(weekday)) return [];

  //   const weekly = availability.weeklySlots?.find(
  //     (w: any) => Number(w.day) === weekday,
  //   );

  //   return weekly?.slots || [];
  // }




  /**
   * Get unavailable dates for a vendor in a specific month/year
   */
  async getUnavailableDatesByRange(
    vendorId: Types.ObjectId,
    startDateStr: string,
    endDateStr: string,
  ): Promise<{ unavailableDates: string[] }> {
    const record = await this.availabilityModel.findOne({ vendorId }).lean().exec();

    const unavailableDates: string[] = [];

    const startDate = normalizeToDateOnly(startDateStr);
    const endDate = normalizeToDateOnly(endDateStr);

    if (endDate < startDate) {
      throw new BadRequestException('endDate must be greater than startDate');
    }

    // iterate day-by-day
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const date = new Date(d);
      const dateStr = date.toISOString().split('T')[0];

      // ❌ No availability document → everything unavailable
      if (!record) {
        unavailableDates.push(dateStr);
        continue;
      }

      const weekday = date.getUTCDay();

      // 1️⃣ Override (highest priority)
      const override = record.overrides?.find(
        (o) => normalizeToDateOnly(o.date).getTime() === date.getTime(),
      );

      if (override) {
        if (!override.isAvailable) unavailableDates.push(dateStr);
        continue;
      }

      // 2️⃣ Range
      const range = record.ranges?.find(
        (r) =>
          date >= normalizeToDateOnly(r.startDate) &&
          date <= normalizeToDateOnly(r.endDate),
      );

      if (range) {
        if (!range.isAvailable) unavailableDates.push(dateStr);
        continue;
      }

      // 3️⃣ Weekly fallback
      const isWeeklyAvailable = record.weeklyAvailableDays?.includes(weekday);

      if (!isWeeklyAvailable) {
        unavailableDates.push(dateStr);
      }
    }

    return { unavailableDates };
  }


  /**
   * Check if a vendor's availability is managed (configured) or not
   */
  async isAvailabilityManaged(vendorId: Types.ObjectId): Promise<{
    isManaged: boolean;
    hasWeeklyDays: boolean;
    hasWeeklySlots: boolean;
    hasOverrides: boolean;
    hasRanges: boolean;
  }> {
    const record = await this.availabilityModel.findOne({ vendorId }).lean().exec();

    if (!record) {
      return {
        isManaged: false,
        hasWeeklyDays: false,
        hasWeeklySlots: false,
        hasOverrides: false,
        hasRanges: false,
      };
    }

    const hasWeeklyDays = (record.weeklyAvailableDays?.length ?? 0) > 0;
    const hasWeeklySlots = (record.weeklySlots?.length ?? 0) > 0;
    const hasOverrides = (record.overrides?.length ?? 0) > 0;
    const hasRanges = (record.ranges?.length ?? 0) > 0;

    // Considered "managed" if weeklyAvailableDays is configured
    const isManaged = hasWeeklyDays;

    return {
      isManaged,
      hasWeeklyDays,
      hasWeeklySlots,
      hasOverrides,
      hasRanges,
    };
  }

  /**
   * Check if vendor is unavailable on a specific date
   */
  async checkUnavailability(
    vendorId: Types.ObjectId,
    dateInput: string,
  ): Promise<{ date: string; isUnavailable: boolean; reason: string | null }> {
    const date = normalizeToDateOnly(dateInput);
    const dateStr = date.toISOString().split('T')[0];

    const record = await this.availabilityModel.findOne({ vendorId }).lean().exec();

    if (!record) {
      return {
        date: dateStr,
        isUnavailable: true,
        reason: 'No availability settings found for vendor.',
      };
    }

    const weekday = date.getUTCDay();

    // 1) Override (highest priority)
    const override = record.overrides?.find(
      (o) => normalizeToDateOnly(o.date).getTime() === date.getTime(),
    );

    if (override) {
      return {
        date: dateStr,
        isUnavailable: !override.isAvailable,
        reason: !override.isAvailable ? (override.reason || 'Override: marked unavailable') : null,
      };
    }

    // 2) Range (second priority)
    const range = record.ranges?.find(
      (r) =>
        date >= normalizeToDateOnly(r.startDate) &&
        date <= normalizeToDateOnly(r.endDate),
    );

    if (range) {
      return {
        date: dateStr,
        isUnavailable: !range.isAvailable,
        reason: !range.isAvailable ? (range.reason || 'Range: marked unavailable') : null,
      };
    }

    // 3) Weekly
    const isWeeklyAvailable = record.weeklyAvailableDays?.includes(weekday);

    if (!isWeeklyAvailable) {
      const dayMap: Record<number, string> = {
        0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
        4: 'Thursday', 5: 'Friday', 6: 'Saturday',
      };
      return {
        date: dateStr,
        isUnavailable: true,
        reason: `Not available on ${dayMap[weekday]}s`,
      };
    }

    return {
      date: dateStr,
      isUnavailable: false,
      reason: null,
    };
  }



}
