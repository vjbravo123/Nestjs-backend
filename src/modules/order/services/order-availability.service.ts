import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../order.schema';
import { AddOn } from '../../addOn/addon.schema';
import { VendorAvailability } from '../../vendoravailability/vendor-availability.schema';
import {
  ExperientialEvent,
  ExperientialEventDocument,
} from '../../experientialevent/experientialevent.schema';
import {
  BirthdayEvent,
  BirthdayEventDocument,
} from '../../birthdayevent/birthdayevent.schema';
import { VendorAvailabilityService } from '../../vendoravailability/vendor-availability.service';

@Injectable()
export class OrderAvailabilityService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(AddOn.name) private addOnModel: Model<AddOn>,
    @InjectModel(VendorAvailability.name)
    private vendorAvailabilityModel: Model<VendorAvailability>,
    @InjectModel(ExperientialEvent.name)
    private readonly experientialEventModel: Model<ExperientialEventDocument>,
    @InjectModel(BirthdayEvent.name)
    private readonly birthdayEventModel: Model<BirthdayEventDocument>,
    private readonly vendorAvailabilityService: VendorAvailabilityService,
  ) {}

  async getAddonsAvailability(query: { city: string; date: string }) {
    const { city, date } = query;

    if (!city || !date) {
      return { data: [], message: 'city and date are required' };
    }

    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);
    const dayOfWeek = queryDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    const nextDay = new Date(queryDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // 1. Get all active addons for the specified city
    const addons = await this.addOnModel
      .find({
        isActive: true,
        'cityOfOperation.name': { $regex: city, $options: 'i' },
      })
      .lean();

    if (addons.length === 0) {
      return { data: [] };
    }

    // 2. Get vendor IDs from addons
    const vendorIds = [
      ...new Set(
        addons.map((a: any) => a.createdBy?.toString()).filter(Boolean),
      ),
    ];
    const vendorObjectIds = vendorIds.map((id) => new Types.ObjectId(id));

    // 3. Get vendor availability for all vendors
    const vendorAvailabilities = await this.vendorAvailabilityModel
      .find({
        vendorId: { $in: vendorObjectIds },
      })
      .lean();

    // Build vendor availability map
    const vendorAvailabilityMap = new Map<string, any>();
    for (const va of vendorAvailabilities) {
      vendorAvailabilityMap.set(va.vendorId.toString(), va);
    }

    // 4. Get booked slots from orders for the given date
    const addonIds = addons.map((a: any) => a._id);
    const bookedSlots = await this.orderModel.aggregate([
      {
        $match: {
          'addons.addOnId': { $in: addonIds },
          status: { $in: ['paid', 'processing', 'confirmed'] },
          eventBookingDate: { $gte: queryDate, $lt: nextDay },
        },
      },
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

    // Build booked slots map: addOnId -> slotType -> bookedQuantity
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

    // 5. Build response - check vendor availability and slot availability
    const result = [];

    for (const addon of addons) {
      const addOnId = (addon as any)._id.toString();
      const vendorId = (addon as any).createdBy?.toString();

      // Get city data for this addon
      const cityData = ((addon as any).cityOfOperation || []).find(
        (c: any) => c.name?.toLowerCase() === city.toLowerCase(),
      );

      if (!cityData) continue;

      // Check vendor availability for the date
      const vendorAvailability = vendorAvailabilityMap.get(vendorId);
      let vendorAvailableSlots: string[] = [];

      if (vendorAvailability) {
        // Check overrides first (highest priority)
        const override = (vendorAvailability.overrides || []).find((o: any) => {
          const overrideDate = new Date(o.date);
          overrideDate.setHours(0, 0, 0, 0);
          return overrideDate.getTime() === queryDate.getTime();
        });

        if (override) {
          if (override.isAvailable) {
            vendorAvailableSlots = override.slots || [];
          } else {
            // Vendor not available on this date
            continue;
          }
        } else {
          // Check range overrides
          const range = (vendorAvailability.ranges || []).find((r: any) => {
            const start = new Date(r.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(r.endDate);
            end.setHours(23, 59, 59, 999);
            return queryDate >= start && queryDate <= end;
          });

          if (range) {
            if (range.isAvailable) {
              vendorAvailableSlots = range.slots || [];
            } else {
              // Vendor not available in this range
              continue;
            }
          } else {
            // Check weekly availability
            const isWeeklyAvailable = (
              vendorAvailability.weeklyAvailableDays || []
            ).includes(dayOfWeek);
            if (!isWeeklyAvailable) {
              continue;
            }

            // Get weekly slots for this day
            const weeklySlot = (vendorAvailability.weeklySlots || []).find(
              (ws: any) => ws.day === dayOfWeek,
            );
            vendorAvailableSlots = weeklySlot?.slots || [];
          }
        }
      }

      // Get booked data for this addon
      const addonBookedMap =
        bookedMap.get(addOnId) || new Map<string, number>();

      // Build slots availability - filter by vendor available slots
      const slotsAvailability: any[] = [];
      for (const slot of cityData.slots) {
        // Check if vendor is available for this slot
        if (
          vendorAvailableSlots.length > 0 &&
          !vendorAvailableSlots.includes(slot.slotType)
        ) {
          continue;
        }

        const maxCapacity = slot.maxSlotBookingsPerDay || 0;
        const booked = addonBookedMap.get(slot.slotType) || 0;
        const available = Math.max(0, maxCapacity - booked);

        if (available > 0) {
          slotsAvailability.push({
            slotType: slot.slotType,
            maxCapacity,
            booked,
            available,
          });
        }
      }

      // Only include addon if it has available slots
    }

    return { data: result };
  }

  async getBookedAddonSlotsByDate(params: {
    addonIds: Types.ObjectId[] | string[];
    date: string; // YYYY-MM-DD
    city?: string;
  }) {
    const { addonIds, date, city } = params;

    const objectIds = (addonIds || [])
      .map((id) => id?.toString())
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!objectIds.length) return [];

    return this.orderModel.aggregate([
      {
        $match: {
          eventDate: date,
          status: { $in: ['paid', 'processing', 'confirmed'] },
          ...(city && {
            'addressDetails.city': { $regex: `^${city}$`, $options: 'i' },
          }),
          'addons.addOnId': { $in: objectIds },
        },
      },
      { $unwind: '$addons' },
      { $match: { 'addons.addOnId': { $in: objectIds } } },
      { $unwind: '$addons.selectedTier.slots' },
      {
        $group: {
          _id: {
            addonId: '$addons.addOnId',
            slotType: '$addons.selectedTier.slots.slotType',
          },
          qty: { $sum: '$addons.selectedTier.slots.quantity' },
        },
      },
    ]);
  }

  async getEventBookingCountsByDate(params: {
    eventId: string | Types.ObjectId;
    city: string;
    startDate: string;
    endDate: string;
  }) {
    const { eventId, city, startDate, endDate } = params;

    const eventObjectId =
      typeof eventId === 'string' ? new Types.ObjectId(eventId) : eventId;

    return this.orderModel.aggregate([
      {
        $match: {
          'event.eventId': eventObjectId,
          status: { $in: ['paid', 'processing', 'confirmed'] },
          eventDate: { $gte: startDate, $lte: endDate },
          'addressDetails.city': { $regex: `^${city}$`, $options: 'i' },
        },
      },
      {
        $group: {
          _id: '$eventDate',
          total: { $sum: 1 },
        },
      },
    ]);
  }

  async getBookingCountsForEvents(params: {
    eventIds: (string | Types.ObjectId)[];
    city: string;
    startDate: Date;
    endDate: Date;
  }) {
    const { eventIds, city, startDate, endDate } = params;

    const objectIds = eventIds.map((id) =>
      typeof id === 'string' ? new Types.ObjectId(id) : id,
    );

    return this.orderModel.aggregate([
      {
        $match: {
          'event.eventId': { $in: objectIds },
          orderStatus: { $in: ['paid', 'processing', 'confirmed'] },
          eventBookingDate: { $gte: startDate, $lte: endDate },
          'addressDetails.city': { $regex: `^${city}$`, $options: 'i' },
        },
      },
      {
        $group: {
          _id: '$event.eventId',
          bookingCount: { $sum: 1 },
        },
      },
    ]);
  }

  async getUnavailableDatesForEvent(params: {
    eventId: string | Types.ObjectId;
    city: string;
    month: number;
    year: number;
    eventType: string;
  }) {
    console.log('INPUT PARAMS:', params);

    const { eventId, city, month, year, eventType } = params;

    const eventObjectId = new Types.ObjectId(eventId as any);
    console.log('eventObjectId:', eventObjectId.toString());

    // -----------------------------------
    // 0️⃣ Fetch Event (NO union model)
    // -----------------------------------
    let event: any = null;

    if (eventType === 'ExperientialEvent') {
      event = await this.experientialEventModel
        .findById(eventObjectId)
        .select('city createdBy')
        .lean();
    } else {
      event = await this.birthdayEventModel
        .findById(eventObjectId)
        .select('city createdBy')
        .lean();
    }

    console.log('EVENT:', event);

    if (!event) return [];

    // -----------------------------------
    // Vendor (experiential only)
    // -----------------------------------
    const vendorIds =
      eventType === 'ExperientialEvent' && event.createdBy
        ? event.createdBy
        : '';

    console.log('vendorIds:', vendorIds);

    // -----------------------------------
    // Resolve maxBookingsPerDay
    // -----------------------------------
    const cityCfg = event.city?.find(
      (c: any) => c.name?.toLowerCase() === city.toLowerCase(),
    );

    console.log('cityCfg:', cityCfg);

    const maxBookingsPerDay = Number(cityCfg?.maxBookingsPerDay || 0);

    console.log('maxBookingsPerDay:', maxBookingsPerDay);

    // -----------------------------------
    // 1️⃣ Build rolling date range
    // -----------------------------------
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));

    const start = today > monthStart ? new Date(today) : new Date(monthStart);

    const end = new Date(monthEnd);
    end.setUTCDate(end.getUTCDate() + 7);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    console.log('today:', today);
    console.log('monthStart:', monthStart);
    console.log('monthEnd:', monthEnd);
    console.log('start:', startStr);
    console.log('end:', endStr);

    // -----------------------------------
    // 2️⃣ Vendor unavailable (bulk)
    // -----------------------------------
    let vendorUnavailableDates: string[] = [];

    if (vendorIds) {
      const vendorResult =
        await this.vendorAvailabilityService.getUnavailableDatesByRange(
          vendorIds,
          startStr,
          endStr,
        );

      console.log('vendorResult:', vendorResult);

      vendorUnavailableDates = vendorResult?.unavailableDates || [];
    }

    console.log('vendorUnavailableDates:', vendorUnavailableDates);

    const vendorUnavailableSet = new Set(vendorUnavailableDates);

    // -----------------------------------
    // 3️⃣ Aggregate orders
    // -----------------------------------
    const rows = await this.orderModel.aggregate([
      {
        $match: {
          'event.eventId': eventObjectId,
          status: { $in: ['paid', 'processing', 'confirmed'] },
          eventDate: { $gte: startStr, $lte: endStr },
          'addressDetails.city': { $regex: `^${city}$`, $options: 'i' },
        },
      },
      {
        $group: {
          _id: '$eventDate',
          total: { $sum: 1 },
        },
      },
    ]);

    console.log('ORDER AGG ROWS:', rows);

    const bookingMap = new Map<string, number>();
    for (const r of rows) bookingMap.set(r._id, r.total);

    console.log('bookingMap:', bookingMap);

    // -----------------------------------
    // 4️⃣ Capacity unavailable
    // -----------------------------------
    const capacityUnavailable = new Set<string>();

    if (maxBookingsPerDay > 0) {
      for (const [d, c] of bookingMap.entries()) {
        if (c >= maxBookingsPerDay) capacityUnavailable.add(d);
      }
    }

    console.log('capacityUnavailable:', Array.from(capacityUnavailable));

    // -----------------------------------
    // 5️⃣ Merge
    // -----------------------------------
    const finalUnavailable = new Set<string>([
      ...vendorUnavailableSet,
      ...capacityUnavailable,
    ]);

    const result = Array.from(finalUnavailable).sort();

    console.log('FINAL UNAVAILABLE:', result);

    return result;
  }
}
