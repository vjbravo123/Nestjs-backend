import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserSchema } from '../users/users.schema'; 
import { BookingSchema } from './schemas/booking.schema'; 
import { PaymentRuleSchema } from './schemas/payment-rule.schema'; 

// --- CONFIGURATION ---
const MONGO_URI = 'mongodb://localhost:27017/zappy'; 

// --- DATA ---
const paymentRulesData = [
  {
    ruleId: "super-early",
    name: "Super Early",
    rangeStart: 61,
    rangeEnd: 999,
    minFlatDeposit: 3000,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    milestones: [
      { id: "se-1", name: "Booking Deposit", percent: 10, daysBefore: null, type: "deposit" },
      { id: "se-2", name: "Intermediate", percent: 40, daysBefore: 30, type: "installment" },
      { id: "se-3", name: "Final Settlement", percent: 50, daysBefore: 7, type: "final" }
    ]
  },
  {
    ruleId: "early",
    name: "Early Bird",
    rangeStart: 31,
    rangeEnd: 60,
    minFlatDeposit: 2000,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    milestones: [
      { id: "e-1", name: "Booking Deposit", percent: 20, daysBefore: null, type: "deposit" },
      { id: "e-2", name: "Intermediate", percent: 30, daysBefore: 15, type: "installment" },
      { id: "e-3", name: "Final Settlement", percent: 50, daysBefore: 7, type: "final" }
    ]
  },
  {
    ruleId: "standard",
    name: "Standard",
    rangeStart: 15,
    rangeEnd: 30,
    minFlatDeposit: 1500,
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    milestones: [
      { id: "s-1", name: "Booking Deposit", percent: 30, daysBefore: null, type: "deposit" },
      { id: "s-2", name: "Final Settlement", percent: 70, daysBefore: 5, type: "final" }
    ]
  },
  {
    ruleId: "late",
    name: "Late",
    rangeStart: 8,
    rangeEnd: 14,
    minFlatDeposit: 1000,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    milestones: [
      { id: "l-1", name: "Booking Deposit", percent: 50, daysBefore: null, type: "deposit" },
      { id: "l-2", name: "Final Settlement", percent: 50, daysBefore: 3, type: "final" }
    ]
  },
  {
    ruleId: "last-minute",
    name: "Last Minute",
    rangeStart: 0,
    rangeEnd: 7,
    minFlatDeposit: 500,
    color: "bg-red-100 text-red-700 border-red-200",
    milestones: [
      { id: "lm-1", name: "Booking Deposit", percent: 80, daysBefore: null, type: "deposit" },
      { id: "lm-2", name: "Balance Clearance", percent: 20, daysBefore: 0, type: "final" }
    ]
  }
];


const bookingsRawData = [
  // 1. ORIGINAL DATA 
  {
    bookingId: "2P-0487", 
    clientName: "Alina & Ankit",
    clientEmail: "Alina.Chennai@email.com",
    eventType: "Wedding",
    eventDate: new Date("2026-08-25T18:00:00.000Z"),
    totalAmount: 150000,
    paidAmount: 22500,
    status: "Confirmed",
    appliedRuleId: "early", 
    createdAt: new Date("2026-01-29T13:34:47.205Z"),
    milestones: [
      {
        id: "m1_697b61f7929816a152eec4ae",
        name: "Booking Deposit",
        description: "15% at booking",
        dueDate: new Date("2026-05-25T00:00:00.000Z"),
        amount: 22500,
        status: "Paid",
        isLocked: true
      },
      {
        id: "m2_697b61f7929816a152eec4af",
        name: "Intermediate Adjustment",
        description: "15 Days Before Event",
        dueDate: new Date("2026-08-10T00:00:00.000Z"),
        amount: 45000,
        status: "Pending",
        isLocked: false
      },
      {
        id: "m3_697b61f7929816a152eec4b0",
        name: "Final Settlement",
        description: "5 Days Before Event",
        dueDate: new Date("2026-08-20T00:00:00.000Z"),
        amount: 82500,
        status: "Pending",
        isLocked: false
      }
    ],
    transactions: [
      {
        id: "tx_93526",
        title: "Booking Deposit",
        date: new Date("2024-05-25T10:42:00.000Z"),
        amount: 22500,
        mode: "Credit Card",
        reference: "Visa ••4242",
        adminName: "System",
        status: "Successful"
      }
    ],
    notes: [
      {
        id: 1,
        text: "Client requested vegan options for the starter menu.",
        date: new Date("2026-05-20T10:00:00.000Z"),
        author: "Admin"
      },
      {
        id: 2,
        text: "Sent update regarding venue decor changes.",
        date: new Date("2026-05-22T14:00:00.000Z"),
        author: "System"
      }
    ]
  },
  // 2. OTHER DATA
  {
    clientName: "Rohan Das",
    clientEmail: "rohan.das@example.com",
    eventType: "Wedding Reception",
    eventDate: new Date("2026-08-25T18:00:00.000Z"),
    totalAmount: 150000,
    paidAmount: 22500,
    status: "Confirmed",
    appliedRuleId: "early",
    createdAt: new Date("2026-01-29T13:34:47.205Z"),
    milestones: [
      { id: "m1_xyz", name: "Booking Deposit", dueDate: new Date("2026-08-10"), amount: 45000, status: "Pending" }
    ],
    notes: [{ id: 1, text: "Vegan options.", date: new Date(), author: "System" }]
  },
  {
    clientName: "Vivek Joshi",
    clientEmail: "joshi@gmail.com",
    eventType: "Birthday",
    eventDate: new Date("2026-09-12T09:00:00.000Z"),
    totalAmount: 85000,
    paidAmount: 85000,
    status: "Completed",
    appliedRuleId: "late",
    createdAt: new Date("2026-01-29T13:34:47.227Z"),
    milestones: [
      { id: "m1_abc", name: "Full Payment", dueDate: new Date("2026-09-01"), amount: 85000, status: "Paid", isLocked: true }
    ],
    transactions: [
      { id: "tx_123", title: "Settlement", date: new Date(), amount: 85000, mode: "Bank Transfer", reference: "REF123", adminName: "System" }
    ]
  },
  {
    clientName: "Anjali Mehta",
    clientEmail: "anjali.mehta@corp-events.com",
    eventType: "Corporate Gala",
    eventDate: new Date("2026-12-15T19:00:00.000Z"),
    totalAmount: 500000,
    paidAmount: 100000,
    status: "Confirmed",
    appliedRuleId: "early",
    createdAt: new Date(),
    milestones: [
      { id: "m_new1", name: "Deposit", dueDate: new Date("2026-11-01"), amount: 100000, status: "Paid", isLocked: true }
    ],
    transactions: [
      { id: "tx_999", title: "Deposit", date: new Date(), amount: 100000, mode: "Card", reference: "VISA", adminName: "System" }
    ]
  }
];

// --- SEEDING SCRIPT ---
async function seed() {
  console.log('🌱 Starting Seeding Process...');
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🔌 Connected to MongoDB.');

    // 1. REGISTER MODELS
    const UserModel = mongoose.model('User', UserSchema);
    const BookingModel = mongoose.model('Booking', BookingSchema);
    const PaymentRuleModel = mongoose.model('PaymentRule', PaymentRuleSchema);

    // 2. CLEAR EXISTING DATA
    await UserModel.deleteMany({});
    await BookingModel.deleteMany({});
    await PaymentRuleModel.deleteMany({});
    console.log('🧹 Database cleared.');

    // 3. SEED PAYMENT RULES
    await PaymentRuleModel.insertMany(paymentRulesData);
    console.log(`✅ Seeded ${paymentRulesData.length} Payment Rules.`);

    // 4. PREPARE & SEED USERS
    const uniqueClients = new Map();
    bookingsRawData.forEach((b: any) => {
      if (b.clientEmail && !uniqueClients.has(b.clientEmail)) {
        uniqueClients.set(b.clientEmail, b.clientName);
      }
    });

    const userMap = new Map<string, mongoose.Types.ObjectId>();
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('password123', salt);

    console.log(`👤 Found ${uniqueClients.size} unique clients. Creating Users...`);

    let mobileCounter = 9000000000;

    for (const [email, fullName] of uniqueClients) {
      try {
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0];
        // Ensure lastName is present. For "Alina & Ankit", lastName becomes "& Ankit"
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User';
        
        const currentMobile = mobileCounter++;

        const newUser = new UserModel({
          firstName: firstName,
          lastName: lastName,
          email: email,
          password: defaultPassword,
          mobile: currentMobile,
          role: 'user',
          isActive: true,
          addresses: [{
            name: 'Home',
            address: '123 Seed Street',
            city: 'Metropolis',
            state: 'State',
            pincode: 110001,
            addressType: 'home',
            mobile: currentMobile
          }]
        });

        const savedUser = await newUser.save();
        userMap.set(email, savedUser._id);
        console.log(`   -> Created User: ${fullName} (${email})`);
      } catch (userErr: any) {
        console.error(`   ❌ Failed to create user ${email}:`, userErr.message);
      }
    }

    // 5. SEED BOOKINGS
    console.log('📅 Seeding Bookings...');
    let bookingIdCounter = 488; // Start after existing explicit IDs if any

    const formattedBookings = bookingsRawData.map((b: any) => {
      const userId = userMap.get(b.clientEmail);
      
      if (!userId) {
        console.warn(`   ⚠️ Skipping booking for ${b.clientName} (User not found)`);
        return null; 
      }

      // Use explicit bookingId if provided in raw data (like "2P-0487"), else generate one
      const finalBookingId = b.bookingId || `2P-0${bookingIdCounter++}`;

      return {
        ...b,
        bookingId: finalBookingId,
        client: userId, // This establishes the relation!
        transactions: b.transactions || [],
        notes: b.notes || []
      };
    }).filter(b => b !== null);

    if (formattedBookings.length > 0) {
      await BookingModel.insertMany(formattedBookings);
    }
    
    console.log(`✅ Seeded ${formattedBookings.length} Bookings successfully.`);
    console.log('🏁 Seeding Complete.');

  } catch (err) {
    console.error('❌ GLOBAL Seeding Failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();