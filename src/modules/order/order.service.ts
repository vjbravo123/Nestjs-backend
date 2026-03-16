// order.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus, PaymentStatus } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { CheckoutIntent } from '../checkout/checkout-intent.schema';
import { CartItem } from '../carts/cart.schema';
import { OrderNumberService } from './services/order-number.service';
import { Connection } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AddOn } from '../addOn/addon.schema';
import { VendorBookingService } from './vendor-bookings/vendor-booking.service'
import { ExperientialEvent, ExperientialEventDocument } from '../experientialevent/experientialevent.schema';
import { BirthdayEvent, BirthdayEventDocument } from '../birthdayevent/birthdayevent.schema';
import { User } from '../users/users.schema';
import { UserDocument } from '../users/users.schema';
import { VendorAvailability } from '../vendoravailability/vendor-availability.schema';
import { VendorAvailabilityService } from '../vendoravailability/vendor-availability.service';
import { InstallmentService } from '../installments/installment.service'
import { mapTierSnapshot, mapAddonSnapshotsFromSimplified } from './utils/order-snapshot.utils';
import * as PDFDocument from 'pdfkit'; 

@Injectable()
export class OrderService {
    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel(CartItem.name) private cartModel: Model<CartItem>,
        @InjectModel(CheckoutIntent.name)
        private readonly checkoutIntentModel: Model<CheckoutIntent>,


        // âœ… Experiential Event
        @InjectModel(ExperientialEvent.name)
        private readonly experientialEventModel: Model<ExperientialEventDocument>,

        // âœ… Birthday Event
        @InjectModel(BirthdayEvent.name)
        private readonly birthdayEventModel: Model<BirthdayEventDocument>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(AddOn.name) private addOnModel: Model<AddOn>,
        @InjectModel(VendorAvailability.name) private vendorAvailabilityModel: Model<VendorAvailability>,
        private readonly eventEmitter: EventEmitter2,

        private readonly orderNumberService: OrderNumberService,
        private readonly vendorAvailabilityService: VendorAvailabilityService,
        private readonly installmentService: InstallmentService,
        private readonly vendorBookingService: VendorBookingService,
        @InjectConnection() private readonly connection: Connection,
    ) { }



async generateBookingSummaryPdf(orderId: Types.ObjectId, userId: Types.ObjectId): Promise<Buffer> {
    const order = await this.orderModel.findOne({ _id: orderId }).lean();
    if (!order) throw new NotFoundException('Order not found');

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // --- DESIGN SYSTEM ---
        const colors = { primary: '#312e81', secondary: '#475569', accent: '#e0e7ff' };
        
        // --- HEADER ---
        doc.fillColor(colors.primary).fontSize(26).font('Helvetica-Bold').text('BOOKING SUMMARY', { align: 'center' });
        doc.moveDown(0.5);
        doc.lineWidth(1).strokeColor(colors.primary).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1.5);

        // --- ORDER & EVENT DETAILS ---
        // Helper to draw section headers
        const drawSection = (title: string, yPos: number) => {
            doc.rect(50, yPos - 5, 495, 20).fill(colors.accent);
            doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(11).text(title, 60, yPos);
            return yPos + 35;
        };

        let currentY = doc.y;
        currentY = drawSection('ORDER & EVENT DETAILS', currentY);

        // Mapping fields based on your provided JSON structure
        const details = [
            ['Order Number', order.orderNumber],
            ['Status', (order as any).status?.toUpperCase() || 'N/A'], // Fixed here: maps to 'status'
            ['Event Category', order.event?.eventCategory || 'N/A'],
            ['Event Title', order.event?.eventTitle || 'N/A'],
            ['Event Date', order.eventDate || 'N/A'],
            ['Event Time', order.eventTime || 'N/A'],
            ['Payment Method', (order as any).paymentDetails?.method || 'N/A']
        ];

        doc.fillColor(colors.secondary).fontSize(10);
        details.forEach(([label, value]) => {
            doc.font('Helvetica-Bold').text(label, 60, currentY);
            doc.font('Helvetica').text(String(value), 220, currentY);
            currentY += 18;
        });

        // --- PAYMENT SUMMARY ---
        currentY += 20;
        currentY = drawSection('PAYMENT SUMMARY', currentY);
        
        const priceY = currentY;
        const prices = [
            ['Base Amount', order.baseAmount],
            ['Addons', order.addonsAmount || 0],
            ['Discount', order.discount || 0]
        ];

        doc.fillColor(colors.secondary).fontSize(10);
        prices.forEach(([label, val]) => {
            doc.font('Helvetica').text(String(label), 300, currentY);
            doc.text(`INR ${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, currentY, { align: 'right', width: 80 });
            currentY += 18;
        });

        // Total Amount Box
        currentY += 5;
        doc.rect(280, currentY, 265, 30).fill(colors.primary);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('TOTAL AMOUNT', 300, currentY + 10);
        doc.text(`INR ${Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, currentY + 10, { align: 'right', width: 80 });

        doc.end();
    });
}

    async createOrder(dto: CreateOrderDto, userId: Types.ObjectId) {
        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            const { cartId, couponCode, paymentId } = dto;

            // 1. Fetch only selected items
            const cartAgg = await this.cartModel.aggregate([
                { $match: { _id: cartId, userId } },

                {
                    $project: {
                        items: {
                            $filter: {
                                input: "$items",
                                as: "i",
                                cond: { $eq: ["$$i.isCheckOut", 1] }
                            }
                        }
                    }
                }
            ]).session(session);

            if (!cartAgg.length) throw new NotFoundException("Cart not found");

            const selectedItems = cartAgg[0].items || [];

            if (!selectedItems.length) {
                throw new BadRequestException("No valid items selected for order");
            }

            // 2. Subtotal
            const totalSubtotal = selectedItems.reduce(
                (sum, item) => sum + (item?.subtotal || 0),
                0
            );

            // 3. Coupon
            let discount = 0;
            let couponSnapshot = null;

            if (couponCode) {
                const result = await this.applyCoupon(couponCode, totalSubtotal);
                discount = result.discount;
                couponSnapshot = result.snapshot;
            }

            // 4. Prepare orders
            const checkoutBatchId = new Types.ObjectId();
            let remainingDiscount = discount;

            const orderNumbers = await Promise.all(
                selectedItems.map(() =>
                    this.orderNumberService.getNextOrderNumber(session)
                )
            );

            // 4a. Collect all addon IDs and fetch their details
            const allAddonIds = selectedItems.flatMap((item: any) =>
                (item?.addons || []).map((a: any) => a?.addonId).filter(Boolean)
            );
            const addonDocs = allAddonIds.length > 0
                ? await this.addOnModel.find({ _id: { $in: allAddonIds } }).lean()
                : [];
            const addonMap = new Map(addonDocs.map((doc: any) => [doc._id.toString(), doc]));

            // 4b. Build orders
            const ordersToInsert: Order[] = selectedItems.map((item: any, idx: number) => {
                const orderNumber = orderNumbers[idx];

                const baseAmount = item?.selectedTier?.price || 0;

                // Calculate addons amount from tiersWithSlot
                const addonsAmount = (item?.addons || []).reduce(
                    (sum: number, a: any) => {
                        const addonDoc = addonMap.get(a?.addonId?.toString());
                        if (!addonDoc?.tiers) return sum;

                        const tierTotal = (a?.tiersWithSlot || []).reduce((tSum: number, tw: any) => {
                            const tier = addonDoc.tiers.find((t: any) => t._id.toString() === tw?.tierId?.toString());
                            if (!tier) return tSum;
                            const slotMultiplier = (tw?.slots || []).reduce((s: number, slot: any) => s + (slot.quantity || 1), 0) || 1;
                            return tSum + (tier.price * slotMultiplier);
                        }, 0);

                        return sum + tierTotal;
                    },
                    0
                );

                // Proportional discount
                let proportionalDiscount = 0;
                if (totalSubtotal > 0 && discount > 0) {
                    proportionalDiscount = Math.floor(
                        ((item?.subtotal || 0) / totalSubtotal) * discount
                    );
                }

                if (idx === selectedItems.length - 1) {
                    proportionalDiscount = remainingDiscount;
                }

                remainingDiscount -= proportionalDiscount;

                // Map addons with full details from database
                const mappedAddons = (item?.addons || []).flatMap((a: any) => {
                    const addonDoc = addonMap.get(a?.addonId?.toString());
                    if (!addonDoc) return [];

                    // Create one order addon per tier (for backward compatibility with order schema)
                    return (a?.tiersWithSlot || []).map((tw: any) => {
                        const tier = addonDoc.tiers?.find((t: any) => t._id.toString() === tw?.tierId?.toString());
                        const slots = (tw?.slots || []).map((s: any) => s.slotType);

                        return {
                            addOnId: addonDoc._id,
                            name: addonDoc.name || "",
                            selectedTier: {
                                tierId: tier?._id || null,
                                name: tier?.name || "",
                                price: tier?.price || 0
                            },
                            addOnVendorId: addonDoc.createdBy,
                            banner: addonDoc.banner || [],
                            slots: slots,
                        };
                    });
                });

                return {
                    userId,
                    checkoutBatchId,
                    orderNumber,

                    event: {
                        eventId: item?.eventId || null,
                        eventTitle: item?.eventTitle || "",
                        eventCategory: item?.eventCategory || "",
                        banner: [],
                    },

                    selectedTier: {
                        tierId: item?.selectedTier?.tierId || null,
                        name: item?.selectedTier?.name || "",
                        price: item?.selectedTier?.price || 0,
                        features: item?.selectedTier?.features || [],
                    },

                    addons: mappedAddons,

                    eventDate: item?.eventDate || null,
                    eventTime: item?.eventTime || null,
                    eventBookingDate: item?.eventBookingDate || null,

                    addressId: item?.addressId || null,

                    addressDetails: {
                        name: item?.addressDetails?.name || null,
                        address: item?.addressDetails?.address || null,
                        street: item?.addressDetails?.street || null,
                        isDefault: item?.addressDetails?.isDefault ?? false,
                        landMark: item?.addressDetails?.landMark || null,
                        mobile: item?.addressDetails?.mobile || null,
                        city: item?.addressDetails?.city || null,
                        state: item?.addressDetails?.state || null,
                        pincode: item?.addressDetails?.pincode || null,
                        addressType: item?.addressDetails?.addressType || null,
                        companyName: item?.addressDetails?.companyName || null,
                        gstin: item?.addressDetails?.gstin || null,
                        latitude: item?.addressDetails?.latitude || null,
                        longitude: item?.addressDetails?.longitude || null,
                    },

                    vendorId: item?.assignVendor || null,

                    baseAmount,
                    addonsAmount,
                    subtotal: item?.subtotal || 0,
                    discount: proportionalDiscount,

                    totalAmount: (item?.subtotal || 0) - proportionalDiscount,

                    paymentOption: dto.paymentMethodType,
                    payAmountPercent: dto.payAmountPercent || null,
                    paymentDetails: {
                        method: dto.paymentMethod,
                    },
                    couponCode,
                    couponSnapshot,
                    paymentId,
                    orderStatus: OrderStatus.CONFIRMED,
                    paymentStatus: PaymentStatus.PARTIALLY_PAID,
                } as Order;
            });

            // 5. Insert
            const createdOrders = await this.orderModel.insertMany(
                ordersToInsert,
                { session }
            );

            // 6. Remove selected items
            await this.cartModel.updateOne(
                { _id: cartId },
                { $pull: { items: { isCheckOut: 1 } } },
                { session }
            );

            await session.commitTransaction();
            this.eventEmitter.emit('order.created', {
                email: 'nk580585@gmail.com',
                name: "Narendra",
                orderId: "ND783H8HD",
                amount: 48758,
            });
            return {
                message: 'Order created successfully',
                batchId: checkoutBatchId

            };

        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    }
    async createOrderFromCheckoutIntent(
        checkoutIntentId: Types.ObjectId,
        paymentId: string,
    ) {
        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            // -------------------------------------------------
            // 1ï¸âƒ£ Fetch intent (locked)
            // -------------------------------------------------
            const intent = await this.checkoutIntentModel
                .findById(checkoutIntentId)
                .populate('userId', 'firstName email mobile')
                .session(session);

            if (!intent) throw new Error('Checkout intent not found');

            const user = intent.userId as unknown as UserDocument;
            // -------------------------------------------------
            // 2ï¸âƒ£ Idempotency guard
            // -------------------------------------------------
            const alreadyCreated = await this.orderModel.findOne(
                { checkoutIntentId: intent._id },
                null,
                { session },
            );

            if (alreadyCreated) {
                await session.abortTransaction();
                return alreadyCreated;
            }

            // -------------------------------------------------
            // 3ï¸âƒ£ Prepare batch
            // -------------------------------------------------
            const checkoutBatchId = new Types.ObjectId();
            const ordersToInsert: Partial<Order>[] = [];

            const orderNumbers = await Promise.all(
                intent.items.map(() =>
                    this.orderNumberService.getNextOrderNumber(session),
                ),
            );

            // -------------------------------------------------
            // 4ï¸âƒ£ Prepare addon lookup (single DB hit)
            // -------------------------------------------------
            const intentData = intent.toObject();

            const allAddonIds = intentData.items.flatMap((i: any) =>
                (i?.addons || []).map((a: any) => a?.addonId).filter(Boolean),
            );

            const addonDocs = allAddonIds.length
                ? await this.addOnModel.find({ _id: { $in: allAddonIds } }).lean()
                : [];

            const addonMap = new Map(addonDocs.map((d: any) => [d._id.toString(), d]));

            // -------------------------------------------------
            // 5ï¸âƒ£ Build Orders
            // -------------------------------------------------
            intentData.items.forEach((item: any, idx: number) => {
                const baseAmount = item.selectedTier?.price || 0;

                const addonsAmount = (item?.addons || []).reduce((sum: number, a: any) => {
                    const addonDoc = addonMap.get(a?.addonId?.toString());
                    if (!addonDoc?.tiers) return sum;

                    return (
                        sum +
                        (a?.tiersWithSlot || []).reduce((tSum: number, tw: any) => {
                            const tier = addonDoc.tiers.find(
                                (t: any) => t._id.toString() === tw?.tierId?.toString(),
                            );
                            if (!tier) return tSum;

                            const multiplier =
                                (tw?.slots || []).reduce(
                                    (s: number, slot: any) => s + (slot.quantity || 1),
                                    0,
                                ) || 1;

                            return tSum + tier.price * multiplier;
                        }, 0)
                    );
                }, 0);

                ordersToInsert.push({
                    userId: intent._id ? intent.userId._id || intent.userId : intentData.userId,
                    checkoutIntentId: intent._id,
                    checkoutBatchId,
                    orderNumber: orderNumbers[idx],

                    event: {
                        eventId: item.eventId,
                        eventTitle: item.eventTitle,
                        eventCategory: item.eventCategory,
                        banner: item.banner || [],
                    },

                    selectedTier: item.eventCategory != 'AddOn' ? mapTierSnapshot(item?.selectedTier) : undefined,
                    addons: mapAddonSnapshotsFromSimplified(item.addons, addonMap),

                    eventDate: item.eventDate,
                    eventTime: item.eventTime,
                    eventBookingDate: item.eventBookingDate,
                    addressDetails: item.addressDetails,
                    vendorId: item.assignVendor ?? undefined,
                    paymentOption: intentData.paymentOption,
                    payAmountPercent: intentData.payAmountPercent ? intentData.payAmountPercent : 100,
                    addonsAmount,
                    subtotal: item.subtotal,
                    discount: 0,
                    totalAmount: item.subtotal,
                    paymentDetails: { method: 'online' },
                    paymentId: paymentId.toString(),
                    orderStatus: OrderStatus.CONFIRMED,
                });
            });

            // -------------------------------------------------
            // 6ï¸âƒ£ Insert Orders
            // -------------------------------------------------
            await this.orderModel.insertMany(ordersToInsert, { session });

            // -------------------------------------------------
            // 7ï¸âƒ£ Create Vendor Bookings
            // -------------------------------------------------
            const createdOrders = await this.orderModel.find(
                { checkoutBatchId },
                null,
                { session },
            );

            await this.vendorBookingService.createVendorBookingsFromOrders(
                createdOrders,
                checkoutBatchId,
                session,
            );

            // -------------------------------------------------
            // 8ï¸âƒ£ Clear cart
            // -------------------------------------------------
            if (intent.source === 'cart' && intent.cartId) {
                await this.cartModel.updateOne(
                    { _id: intent.cartId },
                    { $pull: { items: { isCheckOut: 1 } } },
                    { session },
                );
            }

            // -------------------------------------------------
            // 9ï¸âƒ£ Close intent
            // -------------------------------------------------
            intent.status = 'completed';
            intent.orderId = checkoutBatchId;
            await intent.save({ session });

            // -------------------------------------------------
            // ðŸ”Ÿ Create Installment Schedule (ADDED LOGIC)
            // -------------------------------------------------

            const totalBatchAmount = ordersToInsert.reduce(
                (sum, order) => sum + Number(order.totalAmount || 0),
                0,
            );

            // Prepare installment payload object
            const installmentPayload = {
                userId: intent.userId as Types.ObjectId,
                checkoutBatchId: checkoutBatchId as Types.ObjectId,
                totalAmount: intentData.totalPaybleAmount || totalBatchAmount,
                eventDate: intent.nearestEventDate ?? new Date(),
                payAmountPercent: intent.payAmountPercent ?? 100,
                paymentOption: intent.paymentOption ?? 'FULL',
                transactionId: paymentId?.toString(),
            };

            // Call installment service inside same transaction
            await this.installmentService.createInstallmentScheduleFromPaymentOption(
                installmentPayload,
                session, // ðŸ”¥ pass session,
            );


            // -------------------------------------------------
            // ðŸ”Ÿ Commit
            // -------------------------------------------------
            await session.commitTransaction();

            // -------------------------------------------------
            // 1ï¸âƒ£1ï¸âƒ£ Emit AFTER commit
            // -------------------------------------------------
            const bookingDetails = ordersToInsert.map(order => ({
                bookingId: order.orderNumber,
                eventName: order.event?.eventTitle,
                eventDateTime: `${order.eventDate} ${order.eventTime}`,
                venue: order.addressDetails?.address ?? 'N/A',
                amount: Number(order.totalAmount) || 0,
                paymentStatus: 'PAID',
                packageName: order.selectedTier?.name ?? 'Standard',
                packagePrice: order.selectedTier?.price ?? order.totalAmount,
            }));

            this.eventEmitter.emit('booking.confirmed', {
                email: user.email,
                userName: user.firstName,
                mobile: user.mobile,
                bookingDetails,
                bookingSummary: {
                    bookingCount: bookingDetails.length,
                    totalAmount: bookingDetails.reduce((s, b) => s + b.amount, 0),
                    paymentStatus: 'PAID',
                },
            });

            return { success: true, checkoutBatchId };
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            session.endSession();
        }
    }

    async createPendingOrderFromOfflineCheckoutIntent(
        checkoutIntentId: Types.ObjectId,
        paymentId: string,
    ) {
        const session = await this.connection.startSession();
        session.startTransaction();
        console.log("order offline function trigred")
        try {
            // -------------------------------------------------
            // 1ï¸âƒ£ Fetch intent
            // -------------------------------------------------
            const intent = await this.checkoutIntentModel
                .findById(checkoutIntentId)
                .populate('userId', 'firstName email mobile')
                .session(session);

            if (!intent) throw new Error('Checkout intent not found');

            const user = intent.userId as unknown as UserDocument;

            // -------------------------------------------------
            // 2ï¸âƒ£ Idempotency guard
            // -------------------------------------------------
            const alreadyCreated = await this.orderModel.findOne(
                { checkoutIntentId: intent._id },
                null,
                { session },
            );

            if (alreadyCreated) {
                await session.abortTransaction();
                return alreadyCreated;
            }

            // -------------------------------------------------
            // 3ï¸âƒ£ Prepare batch
            // -------------------------------------------------
            const checkoutBatchId = new Types.ObjectId();
            const ordersToInsert: Partial<Order>[] = [];

            const orderNumbers = await Promise.all(
                intent.items.map(() =>
                    this.orderNumberService.getNextOrderNumber(session),
                ),
            );

            const intentData = intent.toObject();

            // -------------------------------------------------
            // 4ï¸âƒ£ Prepare addon lookup
            // -------------------------------------------------
            const allAddonIds = intentData.items.flatMap((i: any) =>
                (i?.addons || []).map((a: any) => a?.addonId).filter(Boolean),
            );

            const addonDocs = allAddonIds.length
                ? await this.addOnModel.find({ _id: { $in: allAddonIds } }).lean()
                : [];

            const addonMap = new Map(
                addonDocs.map((d: any) => [d._id.toString(), d]),
            );

            // -------------------------------------------------
            // 5ï¸âƒ£ Build Orders (OFFLINE VERSION)
            // -------------------------------------------------
            intentData.items.forEach((item: any, idx: number) => {
                const addonsAmount = (item?.addons || []).reduce(
                    (sum: number, a: any) => {
                        const addonDoc = addonMap.get(a?.addonId?.toString());
                        if (!addonDoc?.tiers) return sum;

                        return (
                            sum +
                            (a?.tiersWithSlot || []).reduce(
                                (tSum: number, tw: any) => {
                                    const tier = addonDoc.tiers.find(
                                        (t: any) =>
                                            t._id.toString() ===
                                            tw?.tierId?.toString(),
                                    );
                                    if (!tier) return tSum;

                                    const multiplier =
                                        (tw?.slots || []).reduce(
                                            (s: number, slot: any) =>
                                                s + (slot.quantity || 1),
                                            0,
                                        ) || 1;

                                    return tSum + tier.price * multiplier;
                                },
                                0,
                            )
                        );
                    },
                    0,
                );

                ordersToInsert.push({
                    userId:
                        intent._id
                            ? intent.userId._id || intent.userId
                            : intentData.userId,

                    checkoutIntentId: intent._id,
                    checkoutBatchId,
                    orderNumber: orderNumbers[idx],

                    event: {
                        eventId: item.eventId,
                        eventTitle: item.eventTitle,
                        eventCategory: item.eventCategory,
                        banner: item.banner || [],
                    },

                    selectedTier:
                        item.eventCategory !== 'AddOn'
                            ? mapTierSnapshot(item?.selectedTier)
                            : undefined,

                    addons: mapAddonSnapshotsFromSimplified(
                        item.addons,
                        addonMap,
                    ),

                    eventDate: item.eventDate,
                    eventTime: item.eventTime,
                    eventBookingDate: item.eventBookingDate,
                    addressDetails: item.addressDetails,
                    vendorId: item.assignVendor ?? undefined,

                    paymentOption: intentData.paymentOption,
                    payAmountPercent:
                        intentData.payAmountPercent ?? 100,

                    addonsAmount,
                    subtotal: item.subtotal,
                    discount: 0,
                    totalAmount: item.subtotal,

                    // ðŸ”¥ OFFLINE SPECIFIC
                    paymentDetails: { method: 'offline' },
                    paymentId: paymentId.toString(),
                    orderStatus: OrderStatus.CONFIRMED,
                });
            });

            // -------------------------------------------------
            // 6ï¸âƒ£ Insert Orders
            // -------------------------------------------------
            await this.orderModel.insertMany(ordersToInsert, { session });

            // -------------------------------------------------
            // 7ï¸âƒ£ Create Vendor Bookings
            // (optional: you can delay this until confirmed)
            // -------------------------------------------------
            const createdOrders = await this.orderModel.find(
                { checkoutBatchId },
                null,
                { session },
            );

            await this.vendorBookingService.createVendorBookingsFromOrders(
                createdOrders,
                checkoutBatchId,
                session,
            );

            // -------------------------------------------------
            // 8ï¸âƒ£ Close intent
            // -------------------------------------------------
            intent.status = 'pending';
            intent.orderId = checkoutBatchId;
            await intent.save({ session });




            // -------------------------------------------------
            // 9ï¸âƒ£ Commit
            // -------------------------------------------------
            await session.commitTransaction();
            const bookingDetails = ordersToInsert.map(order => ({
                bookingId: order.orderNumber,
                eventName: order.event?.eventTitle,
                eventDateTime: `${order.eventDate} ${order.eventTime}`,
                venue: order.addressDetails?.address ?? 'N/A',
                amount: Number(order.totalAmount) || 0,
                paymentStatus: 'OFFLINE',
                packageName: order.selectedTier?.name ?? 'Standard',
                packagePrice: order.selectedTier?.price ?? order.totalAmount,
            }));



            // -------------------------------------------------
            // ðŸ”Ÿ Emit pending email (NOT PAID)
            // -------------------------------------------------
            this.eventEmitter.emit('booking.confirmed', {
                email: user.email,
                userName: user.firstName,
                mobile: user.mobile,
                bookingDetails,
                bookingSummary: {
                    bookingCount: bookingDetails.length,
                    totalAmount: bookingDetails.reduce((s, b) => s + b.amount, 0),
                    paymentStatus: 'Pending',
                },
            });

            return { success: true, checkoutBatchId };
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            session.endSession();
        }
    }






    async applyCoupon(code: string, subtotal: number) {
        return { discount: 0, snapshot: null };
    }


    async generateOrderNumber() {
        const count = await this.orderModel.countDocuments();
        return `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
    }

}
