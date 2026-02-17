import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { PaymentRule, PaymentRuleDocument } from './schemas/payment-rule.schema';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { UpdatePaymentRulesDto } from './dto/update-rules.dto';
import { Types } from 'mongoose';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(PaymentRule.name) private ruleModel: Model<PaymentRuleDocument>,
  ) {}

  // --- BOOKINGS ---

    // --- NEW: Create Booking Logic ---
  async create(dto: CreateBookingDto) {
    // 1. Generate a custom ID (e.g., 2P-4821)
    // In production, you might want to check for collisions or use a counter.
    const uniqueId = `2P-${Math.floor(1000 + Math.random() * 9000)}`;

    // 2. Create the model
    const newBooking = new this.bookingModel({
      bookingId: uniqueId,
      client: dto.clientId, // Map the DTO clientId to the Schema 'client' ref
      clientName: dto.clientName,
      clientEmail: dto.clientEmail,
      clientPhone: dto.clientPhone,
      eventType: dto.eventType,
      eventDate: dto.eventDate,
      venue: dto.venue,
      city: dto.city,
      totalAmount: dto.totalAmount,
      // Defaults
      paidAmount: 0,
      status: 'Pending', 
      milestones: [],
      transactions: [],
      notes: []
    });

    // 3. Save to DB
    return newBooking.save();
  }



  async findAll() {
    return this.bookingModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    // Search by custom bookingId (e.g., "2P-0487") OR Mongo _id
    const booking = await this.bookingModel.findOne({
      $or: [
        { bookingId: id }, 
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }
      ]
    }).exec();
    
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // CORE LOGIC: Record Payment
  async recordPayment(id: string, dto: RecordPaymentDto) {
    const booking = await this.findOne(id);

    // 1. Prepare Transaction Object
    const newTransaction = {
      id: `tx_${Math.floor(Math.random() * 1000000)}`,
      title: dto.milestoneId ? 'Milestone Payment' : 'Payment Received',
      amount: dto.amount,
      mode: dto.mode,
      reference: dto.reference,
      adminName: dto.adminName,
      status: 'Successful',
      date: new Date(),
    };

    // 2. Prepare Audit Note
    const newNote = {
      id: Date.now(),
      text: `Payment of ₹${dto.amount} received via ${dto.mode} (Ref: ${dto.reference}). ${dto.note ? `Note: ${dto.note}` : ''}`,
      author: 'System',
      date: new Date(),
    };

    // 3. Logic to update status based on new balance
    const newPaidAmount = booking.paidAmount + dto.amount;
    let newStatus = booking.status;
    
    // Auto-update status logic
    if (newPaidAmount >= booking.totalAmount) {
        newStatus = 'Completed';
    } else if (booking.status === 'Pending' && newPaidAmount > 0) {
        newStatus = 'Confirmed';
    }

    // 4. Prepare MongoDB Update
    const updateQuery: any = {
      $push: { transactions: newTransaction, notes: newNote },
      $inc: { paidAmount: dto.amount },
      $set: { status: newStatus }, // Initialize $set with status
    };
    // 5. If linked to a milestone, mark it as PAID
    if (dto.milestoneId) {
      const milestoneIndex = booking.milestones.findIndex(m => m.id === dto.milestoneId);
      
      if (milestoneIndex > -1) {
        // We use dot notation to update specific fields inside the array
        updateQuery['$set'][`milestones.${milestoneIndex}.status`] = 'Paid';
        updateQuery['$set'][`milestones.${milestoneIndex}.isLocked`] = true;
        
        // Optional: Update transaction title to match milestone name
        newTransaction.title = `Payment: ${booking.milestones[milestoneIndex].name}`;
      }
    }

    // Execute atomic update
    return this.bookingModel.findOneAndUpdate(
      { _id: booking._id },
      updateQuery,
      { new: true } // Return the updated document
    );
  }

   async cancelBooking(id: string) {
    const booking = await this.findOne(id);

    // Add a system note about the cancellation
    const cancelNote = {
      id: Date.now(),
      text: 'Booking was marked as Cancelled by Admin.',
      author: 'System',
      date: new Date(),
    };

    return this.bookingModel.findOneAndUpdate(
      { _id: booking._id },
      { 
        $set: { status: 'Cancelled' },
        $push: { notes: cancelNote }
      },
      { new: true }
    );
  }

// --- SCHEDULE ---

// Inside BookingsService class:

  async updateSchedule(id: string, dto: UpdateScheduleDto) {
    const booking = await this.findOne(id);

    // 1. Validate Total
    const newTotal = dto.milestones.reduce((sum, m) => sum + Number(m.amount), 0);
    
    // Check strict total matching (allowing 1 rupee diff)
    if (Math.abs(newTotal - booking.totalAmount) > 1) {
       throw new BadRequestException(
         `Schedule total (${newTotal}) must match Booking Total (${booking.totalAmount})`
       );
    }

    // 2. Map and Generate IDs
    const updatedMilestones = dto.milestones.map(m => {
        // If ID is missing or starts with 'temp', generate a new Object ID
        // Note: Using Date.now() is weak for concurrency, using Mongoose ObjectId is safer
        const finalId = (!m.id || m.id.startsWith('temp-')) 
            ? new Types.ObjectId().toString() 
            : m.id;

        return {
            ...m,
            id: finalId
        };
    });

    // 3. Save
    booking.milestones = updatedMilestones as any;
    return booking.save();
  }

  // --- NOTES ---

  async addNote(id: string, text: string, author: string) {
    const note = {
      id: Date.now(),
      text,
      author,
      date: new Date(),
    };
    
    return this.bookingModel.findOneAndUpdate(
      { $or: [{ bookingId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      { $push: { notes: note } },
      { new: true }
    );
  }

  async deleteNote(bookingId: string, noteId: number) {
     return this.bookingModel.findOneAndUpdate(
       { $or: [{ bookingId: bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }] },
       { $pull: { notes: { id: noteId } } },
       { new: true }
     );
  }

  // --- RULES (Global Settings) ---

  async getRules() {
    return this.ruleModel.find().sort({ rangeStart: 1 }).exec();
  }

  async saveRules(dto: UpdatePaymentRulesDto) {
    // Strategy: Clear all and replace
    await this.ruleModel.deleteMany({});
    return this.ruleModel.insertMany(dto.rules);
  }
}