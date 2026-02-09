import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VendorAvailabilityDocument = VendorAvailability & Document;

export enum SlotType {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  TEA = 'tea',
  DINNER = 'dinner',
}

/** Weekly slots per weekday */
@Schema({ _id: false })
export class WeeklySlotEntry {
  @Prop({ required: true, min: 0, max: 6 })
  day: number; // 0=Sun..6=Sat

  @Prop({ type: [String], default: [] })
  slots: SlotType[]; // fixed timings mapped in backend
}
export const WeeklySlotEntrySchema =
  SchemaFactory.createForClass(WeeklySlotEntry);

/** Single date override (with slots) */
@Schema({ timestamps: true })
export class OverrideEntry {
  @Prop({ required: true })
  date: Date; // normalized 00:00 UTC

  @Prop({ required: true })
  isAvailable: boolean;

  // ✅ slots only meaningful if isAvailable=true
  @Prop({ type: [String], default: [] })
  slots: SlotType[];

  @Prop()
  reason?: string;
}
export const OverrideEntrySchema =
  SchemaFactory.createForClass(OverrideEntry);

/** Range override (with slots) */
@Schema({ timestamps: true })
export class RangeEntry {
  @Prop({ required: true })
  startDate: Date; // normalized 00:00 UTC

  @Prop({ required: true })
  endDate: Date; // normalized 00:00 UTC

  @Prop({ required: true })
  isAvailable: boolean;

  // ✅ range can define same slots for all days in that range
  @Prop({ type: [String], default: [] })
  slots: SlotType[];

  @Prop()
  reason?: string;
}
export const RangeEntrySchema =
  SchemaFactory.createForClass(RangeEntry);

@Schema({ timestamps: true })
export class VendorAvailability {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, unique: true })
  vendorId: Types.ObjectId;

  /** Weekly open days */
  @Prop({ type: [Number], default: [] })
  weeklyAvailableDays: number[]; // [1,2,3,4,5]

  /** Weekly slots per weekday (Mon slots, Tue slots...) */
  @Prop({ type: [WeeklySlotEntrySchema], default: [] })
  weeklySlots: WeeklySlotEntry[];

  /** Single date overrides */
  @Prop({ type: [OverrideEntrySchema], default: [] })
  overrides: OverrideEntry[];

  /** Range overrides */
  @Prop({ type: [RangeEntrySchema], default: [] })
  ranges: RangeEntry[];
}

export const VendorAvailabilitySchema =
  SchemaFactory.createForClass(VendorAvailability);
