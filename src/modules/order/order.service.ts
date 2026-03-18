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
import { join } from 'path';
import * as fs from 'fs';
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

    async getUserOrdersByCheckoutId(
    checkoutId: Types.ObjectId,
    userId: Types.ObjectId,
  ) {
    console.log("👉 checkoutId,userID", checkoutId, userId);

    const result = await this.orderModel.aggregate([

      // ---------------------------------
      // MATCH ORDER
      // ---------------------------------
      {
        $match: {
          checkoutIntentId: checkoutId,
          userId,
        },
      },

      // ---------------------------------
      // EVENT LOOKUPS
      // ---------------------------------
      {
        $lookup: {
          from: 'birthdayevents',
          localField: 'event.eventId',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                _id: 1,
                title: 1,
                banner: 1,
                city: 1,
                description: 1,
                duration: 1,
                tiers: 1,
                coreActivity: 1,
                experientialEventCategory: 1,
                subExperientialEventCategory: 1,
              },
            },
          ],
          as: 'birthdayEvent',
        },
      },
      {
        $lookup: {
          from: 'experientialevents',
          localField: 'event.eventId',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                _id: 1,
                title: 1,
                banner: 1,
                city: 1,
                description: 1,
                duration: 1,
                tiers: 1,
                coreActivity: 1,
                experientialEventCategory: 1,
                subExperientialEventCategory: 1,
              },
            },
          ],
          as: 'experientialEvent',
        },
      },

      // ---------------------------------
      // SELECT EVENT DATA
      // ---------------------------------
      {
        $addFields: {
          eventData: {
            $cond: [
              { $eq: ['$event.eventCategory', 'BirthdayEvent'] },
              { $arrayElemAt: ['$birthdayEvent', 0] },
              { $arrayElemAt: ['$experientialEvent', 0] },
            ],
          },
        },
      },

      { $project: { birthdayEvent: 0, experientialEvent: 0 } },

      // ---------------------------------
      // FILTER EVENT TIER
      // ---------------------------------
      {
        $addFields: {
          'eventData.tiers': {
            $filter: {
              input: '$eventData.tiers',
              as: 'tier',
              cond: { $eq: ['$$tier._id', '$selectedTier.tierId'] },
            },
          },
        },
      },

      // ---------------------------------
      // EXPERIENTIAL CATEGORY
      // ---------------------------------
      {
        $lookup: {
          from: 'dropdownoptions',
          let: {
            ids: {
              $cond: [
                { $isArray: '$eventData.experientialEventCategory' },
                '$eventData.experientialEventCategory',
                [{ $ifNull: ['$eventData.experientialEventCategory', null] }],
              ],
            },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            { $project: { _id: 1, value: 1, label: 1, isActive: 1 } },
          ],
          as: 'eventData.experientialEventCategory',
        },
      },

      // ---------------------------------
      // SUB CATEGORY
      // ---------------------------------
      {
        $lookup: {
          from: 'subexperientialeventcategories',
          let: {
            ids: { $ifNull: ['$eventData.subExperientialEventCategory', []] },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            {
              $project: {
                _id: 1,
                name: 1,
                experientialEventCategoryId: 1,
              },
            },
          ],
          as: 'eventData.subExperientialEventCategory',
        },
      },

      // ---------------------------------
      // ADDONS LOOKUP
      // ---------------------------------
      {
        $lookup: {
          from: 'addons',
          let: { ids: '$addons.addOnId' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$ids'] } } },
            {
              $project: {
                _id: 1,
                name: 1,
                banner: 1,
                category: 1,
                description: 1,
                tiers: 1,
                cityOfOperation: 1,
                isActive: 1,
              },
            },
          ],
          as: 'addonsData',
        },
      },

      // ---------------------------------
      // MERGE ADDONS
      // ---------------------------------
      {
        $addFields: {
          addons: {
            $map: {
              input: '$addons',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$addonsData',
                          as: 'a',
                          cond: { $eq: ['$$a._id', '$$item.addOnId'] },
                        },
                      },
                      0,
                    ],
                  },
                ],
              },
            },
          },
        },
      },

      { $project: { addonsData: 0 } },

      // ---------------------------------
      // FILTER ADDON TIERS
      // ---------------------------------
      {
        $addFields: {
          addons: {
            $map: {
              input: '$addons',
              as: 'addon',
              in: {
                $mergeObjects: [
                  '$$addon',
                  {
                    tiers: {
                      $filter: {
                        input: '$$addon.tiers',
                        as: 'tier',
                        cond: {
                          $eq: ['$$tier._id', '$$addon.selectedTier.tierId'],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },

      // ---------------------------------
      // ✅ PAYMENT LOOKUP (LATEST)
      // ---------------------------------
      {
        $lookup: {
          from: 'payments',
          localField: 'checkoutIntentId',
          foreignField: 'checkoutIntentId',
          pipeline: [
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 1,
                merchantOrderId: 1,
                merchantTransactionId: 1,
                amount: 1,
                currency: 1,
                status: 1,
                gateway: 1,
                gatewayTransactionId: 1,
                paidAt: 1,
                createdAt: 1,
                updatedAt: 1,
                paymentMethod: 1,
                webhookProcessed: 1,
                isRefunded: 1,
                feeAmount: 1,

                "gatewayResponse.payload.merchantId": 1,
                "gatewayResponse.payload.orderId": 1,
                "gatewayResponse.payload.state": 1,
                "gatewayResponse.payload.amount": 1,
                "gatewayResponse.payload.currency": 1,
                "gatewayResponse.payload.expireAt": 1,
                "gatewayResponse.payload.paymentDetails": 1,
                "gatewayResponse.payload.splitInstruments": 1,
              },
            },
          ],
          as: 'paymentDetails',
        },
      },

      // ---------------------------------
      // FLATTEN PAYMENT
      // ---------------------------------
      {
        $addFields: {
          paymentDetails: {
            $cond: [
              { $gt: [{ $size: '$paymentDetails' }, 0] },
              { $arrayElemAt: ['$paymentDetails', 0] },
              null,
            ],
          },
        },
      },

      // ---------------------------------
      // PAYMENT RESULT
      // ---------------------------------
      {
        $addFields: {
          paymentResult: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$paymentDetails.status', 'success'] },
                  then: 'SUCCESS',
                },
                {
                  case: { $eq: ['$paymentDetails.status', 'failed'] },
                  then: 'FAILED',
                },
                {
                  case: { $eq: ['$paymentDetails.status', 'cancelled'] },
                  then: 'CANCELLED',
                },
                {
                  case: { $eq: ['$paymentDetails.status', 'pending'] },
                  then: 'PENDING',
                },
              ],
              default: 'PENDING',
            },
          },

          isPaymentFinal: {
            $in: ['$paymentDetails.status', ['success', 'failed', 'cancelled']],
          },
        },
      },
    ]);

    console.log("👉 Aggregation result:", JSON.stringify(result, null, 2));

    if (!result.length) {
      throw new NotFoundException('Order not found or unauthorized');
    }

    return result;
  }


async generateBookingSummaryPdf(orderId: Types.ObjectId, userId: Types.ObjectId): Promise<Buffer> {
    const aggregationResult = await this.orderModel.aggregate([
        { $match: { _id: orderId } },
        {
            $lookup: {
                from: 'birthdayevents',
                localField: 'event.eventId',
                foreignField: '_id',
                as: 'birthdayEvent',
            },
        },
        {
            $lookup: {
                from: 'experientialevents',
                localField: 'event.eventId',
                foreignField: '_id',
                as: 'experientialEvent',
            },
        },
        {
            $addFields: {
                eventData: {
                    $cond: [
                        { $eq: ['$event.eventCategory', 'BirthdayEvent'] },
                        { $arrayElemAt: ['$birthdayEvent', 0] },
                        { $arrayElemAt: ['$experientialEvent', 0] },
                    ],
                },
            },
        },
        {
            $lookup: {
                from: 'payments',
                localField: 'checkoutIntentId',
                foreignField: 'checkoutIntentId',
                pipeline: [{ $sort: { createdAt: -1 } }, { $limit: 1 }],
                as: 'paymentDetailsRaw',
            },
        },
        {
            $addFields: {
                paymentInfo: { $arrayElemAt: ['$paymentDetailsRaw', 0] }
            }
        }
    ]);

    const order = aggregationResult[0];
    if (!order) throw new NotFoundException('Order not found');

    const logoPath = join(process.cwd(), 'src', 'assets', 'zappy-logo.png');
    let logoBuffer: Buffer | null = null;
    try {
        if (fs.existsSync(logoPath)) logoBuffer = fs.readFileSync(logoPath);
    } catch (e) { console.error("Logo not found"); }

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ 
            size: 'A4', 
            margins: { top: 35, left: 50, right: 50, bottom: 35 }
        });
        
        const regularFont = join(process.cwd(), 'src', 'assets', 'fonts', 'Roboto-Regular.ttf');
        const boldFont = join(process.cwd(), 'src', 'assets', 'fonts', 'Roboto-Bold.ttf');

        doc.font(regularFont);
        
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const colors = {
            primary: '#7c3aed', 
            accent: '#db2777',
            secondary: '#475569',
            text: '#1e293b',
            bgLight: '#f8fafc',
            border: '#e2e8f0',
            white: '#ffffff'
        };

        const formatCurrency = (amount: number) => `₹ ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        
        const formatDate = (dateInput: any) => {
            if (!dateInput) return 'N/A';
            const d = new Date(dateInput);
            return isNaN(d.getTime()) ? String(dateInput) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        };

        let currentY = 35;
        const fullWidth = 495;

        const checkPageBreak = (neededHeight: number) => {
            if (currentY + neededHeight > 800) { 
                doc.addPage(); 
                currentY = 35; 
                doc.font(regularFont);
            }
        };

        const drawSectionHeader = (title: string) => {
            checkPageBreak(30);
            doc.rect(50, currentY, fullWidth, 20).fill(colors.primary); 
            doc.fillColor(colors.white).font(boldFont).fontSize(9).text(title.toUpperCase(), 65, currentY + 6);
            currentY += 26;
        };

        const drawRow = (label: string, value: string | number) => {
            const textValue = String(value || 'N/A');
            const textHeight = doc.heightOfString(textValue, { width: 320 });
            const rowHeight = Math.max(18, textHeight + 6);
            
            checkPageBreak(rowHeight);
            doc.rect(50, currentY, fullWidth, rowHeight).fill(colors.bgLight);
            doc.fillColor(colors.secondary).font(boldFont).fontSize(8.5).text(label, 65, currentY + (rowHeight/2 - 4));
            doc.fillColor(colors.text).font(regularFont).fontSize(8.5).text(textValue, 180, currentY + (rowHeight/2 - 4), { width: 350 });
            
            doc.strokeColor(colors.border).lineWidth(0.5).moveTo(50, currentY + rowHeight).lineTo(545, currentY + rowHeight).stroke();
            currentY += rowHeight;
        };

        const drawPriceRow = (label: string, price: string, isBold = false) => {
            checkPageBreak(20);
            if (isBold) doc.rect(50, currentY, fullWidth, 22).fill(colors.bgLight);
            
            doc.fillColor(isBold ? colors.text : colors.secondary)
               .font(isBold ? boldFont : regularFont).fontSize(9);
            doc.text(label, 65, currentY + (isBold ? 7 : 5));
            doc.text(price, 50, currentY + (isBold ? 7 : 5), { align: 'right', width: 475 });
            currentY += isBold ? 26 : 18;
        };

        // ================= HEADER =================
        if (logoBuffer) {
            doc.image(logoBuffer, 50, currentY, { width: 45 });
            doc.fontSize(22).font(boldFont).fillColor(colors.primary).text('Zappy', 105, currentY + 5, { continued: true })
               .fillColor(colors.accent).text(' Events');
            doc.fontSize(8).font(regularFont).fillColor(colors.secondary)
               .text('ZappyEvents Tech Private Limited', 105, currentY + 30)
               .text('GSTIN: 27AAACZ1234A1Z5', 105, currentY + 40);
        }
        doc.fontSize(14).fillColor(colors.primary).font(boldFont).text('BOOKING RECEIPT', 50, currentY + 5, { align: 'right' });
        doc.fontSize(8).fillColor(colors.secondary).font(regularFont).text(`Generated: ${formatDate(new Date())}`, 50, currentY + 20, { align: 'right' });

        currentY += 65;

        // ================= CUSTOMER DETAILS =================
        const addr = order.addressDetails || {};
        drawSectionHeader('Customer Details');
        drawRow('Name', addr.name);
        drawRow('Mobile', addr.mobile ? `+91 ${addr.mobile}` : 'N/A');
        if (addr.gstin) drawRow('GSTIN', addr.gstin);
        // Removed address from here
        currentY += 8;

        // ================= ORDER DETAILS =================
        drawSectionHeader('Order Details');
        drawRow('Order #', order.orderNumber);
        drawRow('Booking Date', formatDate(order.eventBookingDate));
        
        const displayStatus = order.orderStatus || (order.status === 'paid' ? 'confirmed' : order.status);
        drawRow('Booking Status', String(displayStatus || 'N/A').toUpperCase());
        
        const pMethod = order.paymentInfo?.paymentMethod || order.paymentDetails?.method || 'N/A';
        drawRow('Payment Method', String(pMethod).toUpperCase());

        // Added address here instead
        const addressParts = [addr.address, addr.street, addr.city, addr.state, addr.pincode].filter(Boolean);
        drawRow('Venue Address', addressParts.join(', '));
        currentY += 8;

        // ================= EVENT & PACKAGE =================
        drawSectionHeader('Event & Package');
        drawRow('Category', order.eventData?.experientialEventCategory?.[0]?.label || order.event?.eventCategory);
        drawRow('Title', order.eventData?.title || order.event?.eventTitle);
        drawRow('Timing', `${formatDate(order.eventDate)} at ${order.eventTime}`);
        
        if (order.eventData?.duration) {
            const durationStr = String(order.eventData.duration).toLowerCase().includes('hour') 
                ? order.eventData.duration 
                : `${order.eventData.duration} hours`;
            drawRow('Duration', durationStr);
        }

        if (order.selectedTier) {
            drawRow('Package', String(order.selectedTier.name).toUpperCase());
        }
        currentY += 8;

        if (order.addons?.length > 0) {
            drawSectionHeader('Add-ons');
            order.addons.forEach((addon: any, idx: number) => {
                const label = `${idx + 1}. ${addon.name} (${addon.selectedTier?.name || 'Standard'})`;
                drawPriceRow(label, formatCurrency(addon.selectedTier?.price || 0));
            });
            currentY += 8;
        }

        // ================= PAYMENT SUMMARY =================
        drawSectionHeader('Payment Summary');
        
        const totalAmount = order.totalAmount || 0;
        const discount = order.discount || 0;
        const addonsTotal = order.addonsAmount || 0;
        const base = order.baseAmount || 0;

        const taxableAmount = totalAmount / 1.18;
        const gstAmount = totalAmount - taxableAmount;

        const pStatus = order.paymentStatus || order.status;
        let amountPaid = 0;

        if (pStatus === 'paid') {
            amountPaid = totalAmount;
        } else if (pStatus === 'partially_paid') {
            amountPaid = (totalAmount * (order.payAmountPercent || 0)) / 100;
        } else {
            amountPaid = 0;
        }
        
        const remainingAmount = totalAmount - amountPaid;

        drawPriceRow('Base Package Amount', formatCurrency(base));
        if (addonsTotal > 0) drawPriceRow('Add-ons Total', formatCurrency(addonsTotal));
        if (discount > 0) drawPriceRow('Discount Applied', `- ${formatCurrency(discount)}`);
        
        currentY += 4;
        doc.strokeColor(colors.border).lineWidth(0.5).moveTo(50, currentY).lineTo(545, currentY).stroke();
        currentY += 4;

        drawPriceRow('Taxable Value (Excl. GST)', formatCurrency(taxableAmount));
        drawPriceRow('GST (18%)', formatCurrency(gstAmount));
        
        currentY += 4;
        doc.strokeColor(colors.border).lineWidth(1).moveTo(50, currentY).lineTo(545, currentY).stroke();
        currentY += 4;

        drawPriceRow('Grand Total (Incl. Taxes)', formatCurrency(totalAmount), false);
        drawPriceRow('Total Amount Paid', formatCurrency(amountPaid), true);
        
        if (remainingAmount > 0) {
            drawPriceRow('Remaining Balance to be Paid', formatCurrency(remainingAmount), true);
        } else {
            drawPriceRow('Remaining Balance', formatCurrency(0));
        }

        currentY += 10;
        checkPageBreak(40);
        doc.rect(50, currentY, fullWidth, 30).fill(colors.primary);
        doc.fillColor(colors.white).font(boldFont).fontSize(11).text('NET PAID AMOUNT', 65, currentY + 10);
        doc.text(formatCurrency(amountPaid), 50, currentY + 10, { align: 'right', width: 475 });

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
