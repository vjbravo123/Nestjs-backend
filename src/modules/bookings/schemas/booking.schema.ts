import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/users.schema'; 

export type BookingDocument = HydratedDocument<Booking>;

// --- SUB-SCHEMAS (Embedded) ---

@Schema()
export class Milestone {
  @Prop() // Auto-generate ID if missing
  id: string; 

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ required: true })
  amount: number;

  @Prop({ enum: ['Paid', 'Pending', 'Overdue'], default: 'Pending' })
  status: string;

  @Prop({ default: false })
  isLocked: boolean;
}
const MilestoneSchema = SchemaFactory.createForClass(Milestone);

@Schema()
export class Transaction {
  @Prop({ default: () => `tx_${Math.floor(Math.random() * 1000000)}` })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: Date.now })
  date: Date;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  mode: string; // UPI, Cash, Bank Transfer

  @Prop()
  reference: string; // Transaction ID / Ref No

  @Prop({ required: true })
  adminName: string; // Who recorded this

  @Prop({ default: 'Successful' })
  status: string;
}
const TransactionSchema = SchemaFactory.createForClass(Transaction);

@Schema()
export class Note {
  @Prop({ default: () => Date.now() })
  id: number;

  @Prop({ required: true })
  text: string;

  @Prop({ default: Date.now })
  date: Date;

  @Prop({ required: true })
  author: string;
}
const NoteSchema = SchemaFactory.createForClass(Note);

// --- MAIN SCHEMA ---

@Schema({ timestamps: true })
export class Booking {
  // Custom ID like "2P-0487" (Indexed for Search)
  @Prop({ required: true, unique: true, index: true, trim: true })
  bookingId: string;

  // 👇 RELATIONSHIP: Links this booking to a specific User
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  client: User;

  // --- Snapshots (Static info at time of booking) ---
  
  @Prop({ required: true, index: true }) // Indexed for Client Name search
  clientName: string;

  @Prop({ required: true, lowercase: true, trim: true })
  clientEmail: string;

  @Prop({ trim: true }) 
  clientPhone: string; // Added: Essential for contacting without looking up User profile

  // --- Event Details ---

  @Prop({ required: true, index: true }) // Indexed for Event Type filtering
  eventType: string; // Wedding, Birthday...

  @Prop({ required: true, index: true }) // Indexed for Date sorting
  eventDate: Date;

  @Prop({ trim: true })
  venue: string; // Added: Where is the event?

  @Prop({ trim: true })
  city: string; // Added: Location context

  // --- Financials ---

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ default: 0, min: 0 })
  paidAmount: number;

  // --- Status & Workflow ---

  @Prop({ 
    enum: ['Confirmed', 'Pending', 'Completed', 'Cancelled', 'Draft'], 
    default: 'Pending',
    index: true // Indexed for Status tabs/filtering
  })
  status: string;

  // The ID of the rule used to generate this (e.g., 'super-early')
  @Prop()
  appliedRuleId: string;

  // --- Arrays ---

  @Prop({ type: [MilestoneSchema], default: [] })
  milestones: Milestone[];

  @Prop({ type: [TransactionSchema], default: [] })
  transactions: Transaction[];

  @Prop({ type: [NoteSchema], default: [] })
  notes: Note[];
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Compound Index: Useful if you often sort by Date within a specific Status
BookingSchema.index({ status: 1, eventDate: 1 });