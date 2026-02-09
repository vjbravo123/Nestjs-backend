import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/users.schema'
import { CheckoutIntent } from './checkout-intent.schema';
import { CartItem } from '../carts/cart.schema';
import { CreateCartCheckoutIntentDto } from './dto/create-cart-checkout-intent.dto';
import { CreateDirectCheckoutIntentDto } from './dto/create-direct-checkout-intent.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { DraftToCartMapper } from '../carts/mappers/draft-to-cart.mapper'
import { DraftCartItem, DraftCartItemDocument } from '../carts/draft-cart/draft-cart.schema';
import { BirthdayEvent } from '../birthdayevent/birthdayevent.schema';
import { ExperientialEvent } from '../experientialevent/experientialevent.schema';
import { AddOn } from '../addOn/addon.schema';

@Injectable()
export class CheckoutService {
    constructor(
        @InjectModel(CheckoutIntent.name)
        private readonly checkoutIntentModel: Model<CheckoutIntent>,
        @InjectModel(DraftCartItem.name)
        private readonly draftCartModel: Model<DraftCartItemDocument>,
        @InjectModel(CartItem.name) private cartModel: Model<CartItem>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(BirthdayEvent.name) private readonly birthdayEventModel: Model<BirthdayEvent>,
        @InjectModel(ExperientialEvent.name) private readonly experientialEventModel: Model<ExperientialEvent>,
        @InjectModel(AddOn.name) private readonly addOnModel: Model<AddOn>,
    ) { }

    // =====================================================
    // 🔧 HELPER: Fetch event banner by category
    // =====================================================
    private async getEventBanner(eventId: Types.ObjectId, eventCategory: string): Promise<string[]> {
        let event: any = null;

        if (eventCategory === 'BirthdayEvent') {
            event = await this.birthdayEventModel.findById(eventId).select('banner').lean();
        } else if (eventCategory === 'ExperientialEvent') {
            event = await this.experientialEventModel.findById(eventId).select('banner').lean();
        } else if (eventCategory === 'AddOn') {
            event = await this.addOnModel.findById(eventId).select('banner').lean();
        }

        return event?.banner || [];
    }

    // =====================================================
    // 🔧 HELPER: Fetch addon banners for a list of addons
    // =====================================================
    private async getAddonBanners(addonIds: Types.ObjectId[]): Promise<Map<string, string[]>> {
        const addons = await this.addOnModel.find({
            _id: { $in: addonIds }
        }).select('_id banner').lean();

        const bannerMap = new Map<string, string[]>();
        addons.forEach(addon => {
            bannerMap.set(addon._id.toString(), addon.banner || []);
        });

        return bannerMap;
    }

    // =====================================================
    // 🛒 CART CHECKOUT (MULTIPLE ITEMS, ONLINE PAYMENT)
    // =====================================================
    async createCartCheckoutIntent(
        userId: Types.ObjectId,
        dto: CreateCartCheckoutIntentDto,
    ): Promise<CheckoutResponseDto> {

        const { cartId, couponCode } = dto;

        // 1️⃣ Fetch ONLY selected items using aggregation (same as createOrder)
        const cartAgg = await this.cartModel.aggregate([
            {
                $match: {
                    _id: new Types.ObjectId(cartId),
                    userId,
                    status: 'active',
                },
            },
            {
                $project: {
                    items: {
                        $filter: {
                            input: '$items',
                            as: 'i',
                            cond: { $eq: ['$$i.isCheckOut', 1] },
                        },
                    },
                },
            },
        ]);

        if (!cartAgg.length) {
            throw new NotFoundException('Cart not found');
        }

        const selectedItems = cartAgg[0].items || [];

        if (!selectedItems.length) {
            throw new BadRequestException('No items selected for checkout');
        }

        // 2️⃣ Fetch banners for events and addons
        const itemsWithBanners = await Promise.all(
            selectedItems.map(async (item: any) => {
                // Fetch event banner
                const eventBanner = await this.getEventBanner(item.eventId, item.eventCategory);

                // Fetch addon banners
                const addonIds = (item.addons || []).map((a: any) => a.addOnId);
                const addonBannerMap = addonIds.length > 0
                    ? await this.getAddonBanners(addonIds)
                    : new Map();

                // Add banner to each addon
                const addonsWithBanners = (item.addons || []).map((addon: any) => ({
                    ...addon,
                    banner: addonBannerMap.get(addon.addOnId?.toString()) || [],
                }));

                return {
                    ...item,
                    banner: eventBanner,
                    addons: addonsWithBanners,
                };
            })
        );

        // 3️⃣ Subtotal
        const subtotal = selectedItems.reduce(
            (sum, item) => sum + (item?.subtotal || 0),
            0,
        );

        // 4️⃣ Coupon validation (NO mutation)
        let discount = 0;
        let couponSnapshot = null;

        // if (couponCode) {
        //     const result = await this.applyCoupon(couponCode, subtotal);
        //     discount = result.discount;
        //     couponSnapshot = result.snapshot;
        // }

        const totalAmount = subtotal - discount;

        // 5️⃣ Create checkout intent (temporary)
        const checkoutIntent = await this.checkoutIntentModel.create({
            userId,
            source: 'cart',
            cartId,
            items: itemsWithBanners,
            subtotal,
            discount,
            totalAmount,
            couponCode,
            couponSnapshot,
            status: 'pending',
        });

        return {
            intentId: checkoutIntent._id.toString(),
            totalAmount: checkoutIntent.totalAmount,
            items: checkoutIntent.items,
            status: checkoutIntent.status,
        };
    }


    // =====================================================
    // ⚡ DIRECT CHECKOUT (SINGLE ITEM, ONLINE PAYMENT)
    // =====================================================
    async createDirectCheckoutIntent(
        userId: Types.ObjectId,
        dto: CreateDirectCheckoutIntentDto,
    ): Promise<CheckoutResponseDto> {

        const { couponCode } = dto;

        // 1️⃣ Fetch latest active draft
        const draft = await this.draftCartModel
            .findOne({
                userId,
                isCompleted: false,
            })
            .sort({ updatedAt: -1 })
            .populate('userId');

        if (!draft) {
            throw new NotFoundException('No active draft cart found');
        }

        // 2️⃣ Validations (SAME AS addFromDraftCart)
        if (!draft.selectedTier) {
            throw new BadRequestException('Tier selection required');
        }

        if (!draft.addressId) {
            throw new BadRequestException('Address selection required');
        }

        if (!draft.eventDate || !draft.eventTime) {
            throw new BadRequestException('Event date & time required');
        }

        // 3️⃣ Resolve address snapshot
        const addressDetails = (draft.userId as any).addresses?.find(
            (addr: any) => addr._id.toString() === draft?.addressId?.toString(),
        );

        if (!addressDetails) {
            throw new BadRequestException('Invalid address selected');
        }

        draft.addressDetails = addressDetails;

        // 4️⃣ Convert Draft → CheckoutItem
        const checkoutItem = DraftToCartMapper.toCartItem(draft);

        // 5️⃣ Fetch event banner
        const eventBanner = await this.getEventBanner(
            draft.eventId as Types.ObjectId,
            draft.eventCategory,
        );

        // 6️⃣ Fetch addon banners
        const addonIds = (draft.addons || []).map((a: any) => a.addOnId);
        const addonBannerMap = addonIds.length > 0
            ? await this.getAddonBanners(addonIds)
            : new Map();

        // Add banner to each addon
        const addonsWithBanners = (checkoutItem.addons || []).map((addon: any) => ({
            ...addon,
            banner: addonBannerMap.get(addon.addOnId?.toString()) || [],
        }));

        // 7️⃣ Coupon handling
        let discount = 0;
        let couponSnapshot = null;

        // if (couponCode) {
        //   const result = await this.applyCoupon(couponCode, checkoutItem.subtotal);
        //   discount = result.discount;
        //   couponSnapshot = result.snapshot;
        // }

        const totalAmount = checkoutItem.subtotal - discount;

        // 8️⃣ Create Checkout Intent
        const checkoutIntent = await this.checkoutIntentModel.create({
            userId,
            source: 'direct',
            items: [
                {
                    ...checkoutItem,
                    plannerPrice: checkoutItem.plannerPrice ?? 0,
                    banner: eventBanner,
                    addons: addonsWithBanners,
                },
            ],
            subtotal: checkoutItem.subtotal,
            discount,
            totalAmount,
            couponCode,
            couponSnapshot,
            status: 'pending',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // TTL
        });

        return {
            intentId: checkoutIntent._id.toString(),
            totalAmount: checkoutIntent.totalAmount,
            items: checkoutIntent.items,
            status: checkoutIntent.status,
        };
    }





    // =====================================================
    // 🔍 GET CHECKOUT INTENT (OWNER ONLY)
    // =====================================================
    async getCheckoutIntent(
        intentId: Types.ObjectId,
        userId: Types.ObjectId,
    ) {
        const intent = await this.checkoutIntentModel.findById(intentId);

        if (!intent) {
            throw new NotFoundException('Checkout intent not found');
        }

        // 🔐 Authorization check
        if (intent.userId.toString() !== userId.toString()) {
            throw new ForbiddenException(
                'You are not allowed to access this checkout intent',
            );
        }

        return intent;
    }

    // =====================================================
    // 🔍 GET CHECKOUT INTENT WITH DETAILS (OWNER ONLY)
    // =====================================================
    // =====================================================
    // 🔍 GET CHECKOUT INTENT WITH DETAILS (OWNER ONLY)
    // =====================================================
    async getCheckoutIntentWithDetails(
        intentId: Types.ObjectId,
        userId: Types.ObjectId,
    ) {
        const result = await this.checkoutIntentModel.aggregate([
            // ---------------------------------
            // MATCH CHECKOUT INTENT
            // ---------------------------------
            {
                $match: {
                    _id: intentId,
                    userId,
                },
            },

            // ---------------------------------
            // UNWIND ITEMS
            // ---------------------------------
            {
                $unwind: {
                    path: '$items',
                    preserveNullAndEmptyArrays: false,
                },
            },

            // ---------------------------------
            // EVENT LOOKUPS (Both Collections)
            // ---------------------------------
            {
                $lookup: {
                    from: 'birthdayevents',
                    localField: 'items.eventId',
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
                            },
                        },
                    ],
                    as: 'birthdayEvent',
                },
            },
            {
                $lookup: {
                    from: 'experientialevents',
                    localField: 'items.eventId',
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
            // ADDON LOOKUPS
            // ---------------------------------
            {
                $lookup: {
                    from: 'addons',
                    localField: 'items.addons.addOnId',
                    foreignField: '_id',
                    as: 'addonDetails',
                },
            },

            // ---------------------------------
            // PAYMENT LOOKUP (✅ LATEST PAYMENT ONLY)
            // ---------------------------------
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'checkoutIntentId',
                    pipeline: [
                        { $sort: { createdAt: -1 } }, // ✅ latest
                        { $limit: 1 }, // ✅ only one payment
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

                                // ✅ Additional payment fields
                                paymentMethod: 1,
                                webhookProcessed: 1,
                                isRefunded: 1,
                                feeAmount: 1,

                                // ✅ PhonePe useful raw details (safe subset)
                                "gatewayResponse.payload.merchantId": 1,
                                "gatewayResponse.payload.orderId": 1,
                                "gatewayResponse.payload.state": 1,
                                "gatewayResponse.payload.amount": 1,
                                "gatewayResponse.payload.currency": 1,
                                "gatewayResponse.payload.expireAt": 1,

                                // paymentDetails[0]
                                "gatewayResponse.payload.paymentDetails": 1,

                                // split instruments
                                "gatewayResponse.payload.splitInstruments": 1
                            },
                        },
                    ],
                    as: 'paymentDetails',
                },
            },

            // ---------------------------------
            // MERGE EVENT DATA
            // ---------------------------------
            {
                $addFields: {
                    'items.eventData': {
                        $cond: {
                            if: { $gt: [{ $size: '$birthdayEvent' }, 0] },
                            then: { $arrayElemAt: ['$birthdayEvent', 0] },
                            else: { $arrayElemAt: ['$experientialEvent', 0] },
                        },
                    },

                    'items.addons': {
                        $map: {
                            input: '$items.addons',
                            as: 'addon',
                            in: {
                                $mergeObjects: [
                                    '$$addon',
                                    {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: '$addonDetails',
                                                    as: 'detail',
                                                    cond: {
                                                        $eq: ['$$detail._id', '$$addon.addOnId'],
                                                    },
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

            // ---------------------------------
            // GROUP BACK ITEMS
            // ---------------------------------
            {
                $group: {
                    _id: '$_id',
                    userId: { $first: '$userId' },
                    cartId: { $first: '$cartId' },
                    source: { $first: '$source' },
                    subtotal: { $first: '$subtotal' },
                    discount: { $first: '$discount' },
                    totalAmount: { $first: '$totalAmount' },
                    couponCode: { $first: '$couponCode' },
                    status: { $first: '$status' },
                    paymentId: { $first: '$paymentId' },
                    orderId: { $first: '$orderId' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },

                    // from lookup (already limited to 1)
                    paymentDetails: { $first: '$paymentDetails' },

                    items: { $push: '$items' },
                },
            },

            // ---------------------------------
            // FLATTEN PAYMENT DETAILS
            // ---------------------------------
            {
                $addFields: {
                    paymentDetails: {
                        $cond: {
                            if: { $gt: [{ $size: '$paymentDetails' }, 0] },
                            then: { $arrayElemAt: ['$paymentDetails', 0] },
                            else: null,
                        },
                    },
                },
            },

            // ---------------------------------
            // ADD PAYMENT RESULT FOR FRONTEND
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

        if (!result || result.length === 0) {
            throw new NotFoundException('Checkout intent not found or unauthorized');
        }

        return result[0];
    }


    // =====================================================
    // 🔁 INTERNAL: MARK INTENT AS PAID (WEBHOOK USE)
    // =====================================================
    async markCheckoutIntentAsPaid(
        intentId: Types.ObjectId,
        paymentId: string,
    ) {
        const intent = await this.checkoutIntentModel.findOne({
            _id: intentId,
            status: 'pending',
        });

        if (!intent) {
            // idempotent – already processed or expired
            return null;
        }

        intent.status = 'paid';
        intent.paymentId = paymentId;

        await intent.save();
        return intent;
    }

    // =====================================================
    // ❌ INTERNAL: MARK INTENT AS FAILED
    // =====================================================
    async markCheckoutIntentAsFailed(
        intentId: Types.ObjectId,
    ) {
        const intent = await this.checkoutIntentModel.findOne({
            _id: intentId,
            status: 'pending',
        });

        if (!intent) {
            return null;
        }

        intent.status = 'failed';
        await intent.save();

        return intent;
    }
}
