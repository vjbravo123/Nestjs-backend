import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from '../order/order.schema';
import { Cart } from './cart.schema';
import { AddOn } from '../addOn/addon.schema';
import { BirthdayEvent } from '../birthdayevent/birthdayevent.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { mergeDateAndTime } from '../../common/utils/mergeDateAndTime';
import { Coupon } from '../coupon/coupon.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(AddOn.name) private readonly addOnModel: Model<AddOn>,
    @InjectModel(BirthdayEvent.name)
    private readonly eventModel: Model<BirthdayEvent>,
    @InjectModel(Coupon.name) private readonly couponModel: Model<Coupon>,
  ) { }

  /** 🔹 Common: Calculate discounted price */
  private calculateDiscountedPrice(price: number, discount: number): number {
    if (!price || price <= 0) return 0;
    if (!discount || discount <= 0) return Math.ceil(price);
    return Math.ceil(price - (price * discount) / 100);
  }

  /** 🔹 Common: Fetch AddOns and calculate total */
  private async getAddOnsAndTotal(
    addOnIds: string[] | undefined,
  ): Promise<{ addOnIds: Types.ObjectId[]; total: number }> {
    if (!addOnIds?.length) return { addOnIds: [], total: 0 };

    const ids = addOnIds.map((id) => new Types.ObjectId(id));
    const addOns = await this.addOnModel.find({ _id: { $in: ids } }, { price: 1 });

    if (addOns.length !== ids.length) {
      throw new BadRequestException('Some add-ons not found');
    }

    const total = addOns.reduce((sum, a) => sum + (a.price || 0), 0);
    return { addOnIds: ids, total };
  }

  /** 🔹 Common: Final item total = tier + addons + planner */
  private calculateItemTotal(
    tierPrice: number,
    addOnTotal: number,
    plannerPrice?: number,
  ): number {
    return tierPrice + addOnTotal + (plannerPrice || 0);
  }

  /** 🔹 Common: Compute full cart totals */
  private async computeCartTotals(cart: any, event: any): Promise<void> {
    const currentTier = event.tiers?.find(
      (t: any) => String(t._id) === String(cart.selectedTierId),
    );
    if (!currentTier) throw new BadRequestException('Tier not found for this event');

    const discount = event.discount ? Number(event.discount) : 0;
    const tierPrice = this.calculateDiscountedPrice(currentTier.price, discount);

    const addOns = await this.addOnModel.find(
      { _id: { $in: cart.addOnIds || [] } },
      { price: 1 },
    );
    const addOnTotal = addOns.reduce((sum, a) => sum + (a.price || 0), 0);

    cart.discountedPrice = tierPrice;
    cart.itemTotal = this.calculateItemTotal(tierPrice, addOnTotal, cart.plannerPrice);
  }

  /** ---------------- ADD TO CART ---------------- */
  async addItemToCart(userId: string, dto: AddToCartDto) {
    console.log("userId in add to cart", userId);
    const event = await this.eventModel.findById(dto.eventId);
    if (!event) throw new NotFoundException('Event not found');

    const tier = (event as any).tiers?.find(
      (t: any) => String(t._id) === String(dto.selectedTierId),
    );
    if (!tier) throw new BadRequestException('Selected tier not found for this event');
    const discount = event.discount ? Number(event.discount) : 0;
    const tierPrice = this.calculateDiscountedPrice(tier.price, discount);
    let cart = await this.cartModel.findOne({ user: userId });
    const { addOnIds } = await this.getAddOnsAndTotal(dto.addOnIds || []);

    if (cart) {
      if (String(cart.event) !== String(event._id)) {
        // 🟢 Different event → reset cart
        cart.event = event._id;
        cart.eventTitle = dto.eventTitle;
        cart.selectedTierId = new Types.ObjectId(dto.selectedTierId);
        cart.addOnIds = [];
        cart.plannerPrice = undefined;
        cart.discountedPrice = tierPrice;
        cart.eventBookingDate = undefined;
        cart.eventDate = undefined;
        cart.eventTime = undefined;
        cart.addressId = undefined;
      }
      else {

        cart.selectedTierId = new Types.ObjectId(dto.selectedTierId);
        //   // 🟢 Same event → update cart
        //   cart.selectedTierId = new Types.ObjectId(dto.selectedTierId);
        //   cart.event =
        //     cart.addOnIds = cart.addOnIds;
        //   cart.discountedPrice = tierPrice;
        //   cart.eventTitle = dto.eventTitle;
        //   cart.addressId = cart.addressId ? new Types.ObjectId(dto.addressId) : undefined;
        //   cart.location = dto.location;
      }
      await this.computeCartTotals(cart, event);
      return cart.save();
    }


    // New cart
    cart = new this.cartModel({
      user: userId,
      event: event._id,
      eventTitle: dto.eventTitle,
      selectedTierId: new Types.ObjectId(dto.selectedTierId),
      addOnIds,
      discountedPrice: tierPrice,
    });

    await this.computeCartTotals(cart, event);
    return cart.save();
  }

  /** ---------------- UPDATE CART ---------------- */
  async updateCartItem(cartId: string, userId: string, dto: UpdateCartDto) {
    const cart: any = await this.cartModel
      .findOne({ _id: cartId, user: userId })
      .populate('event')
      .populate('user', 'name email addresses firstName lastName mobile');

    if (!cart) throw new NotFoundException('Cart item not found');

    if (dto.addressId !== undefined) {
      cart.addressId = dto.addressId ? new Types.ObjectId(dto.addressId) : undefined;
    }
    if (dto.eventAddress !== undefined) cart.eventAddress = dto.eventAddress;
    if (dto.guests !== undefined) cart.guests = dto.guests as any;
    if (dto.location !== undefined) cart.location = dto.location;
    if (dto.status !== undefined) cart.status = dto.status;
    if (dto.plannerPrice !== undefined) cart.plannerPrice = dto.plannerPrice;

    // ✅ handle add-ons
    if (dto.addOnIds !== undefined) {
      if (Array.isArray(dto.addOnIds) && dto.addOnIds.length > 0) {
        const { addOnIds: validatedIds } = await this.getAddOnsAndTotal(dto.addOnIds);
        cart.addOnIds = validatedIds;
      } else {
        cart.addOnIds = [];
      }
    }



    if (dto.eventDate && dto.eventTime) {
      const selectedAddress = cart.user?.addresses?.find(
        (address) => String(address._id) === String(dto.addressId),
      );

      const eventBookingDate = mergeDateAndTime(dto.eventDate, dto.eventTime);
      const eventBookingDay = new Date(dto.eventDate);
      eventBookingDay.setUTCHours(0, 0, 0, 0);

      cart.eventBookingDate = eventBookingDate;
      cart.eventBookingDay = eventBookingDay;

      // Date range for the booking day
      const startOfDay = new Date(eventBookingDay);
      const endOfDay = new Date(eventBookingDay);
      endOfDay.setUTCHours(23, 59, 59, 999);

      // Availability check
      const checkIsAvailableDatesForBooking = await this.orderModel.countDocuments({
        "event._id": cart.event._id,
        "eventAddress.city": selectedAddress?.city,
        eventBookingDate: { $gte: startOfDay, $lte: endOfDay },
      });

      const maxBookings = cart.event.city.find(
        (c: any) => c.name === selectedAddress?.city
      )?.maxBookingsPerDay;

      if (maxBookings && checkIsAvailableDatesForBooking >= maxBookings) {
        throw new BadRequestException(
          'Selected date is fully booked. Please choose another date.'
        );
      }

      cart.eventDate = dto.eventDate;
      cart.eventTime = dto.eventTime;
    }
    // ✅ validate selected tier
    const event = await this.eventModel.findById(cart.event);
    if (!event) throw new NotFoundException('Event not found');

    if (dto.selectedTierId) {
      const tier = event.tiers?.find(
        (t: any) => String(t._id) === String(dto.selectedTierId),
      );
      if (!tier) throw new BadRequestException('Selected tier not found for this event');
      cart.selectedTierId = new Types.ObjectId(dto.selectedTierId);
    }

    await this.computeCartTotals(cart, event);
    return cart.save();
  }

  /** ---------------- GET CART ITEM ---------------- */
  async getCartIteById(cartId: string) {
    const cartItem: any = await this.cartModel
      .findById(cartId)
      .populate('user', 'name email addresses firstName lastName mobile')
      .populate('event')
      .populate('selectedTierId')
      .populate('addOnIds', 'name description price maxQuantity')
      .populate('addressId')
      .lean();

    if (!cartItem || !cartItem.event) {
      throw new NotFoundException('Cart item not found');
    }

    // ✅ Safely get selected tier
    const selectedTier = Array.isArray(cartItem.event.tiers)
      ? cartItem.event.tiers.find(
        (tier: any) => tier._id.toString() === cartItem.selectedTierId?.toString()
      )
      : null;

    // ✅ Safely get selected address
    const selectedAddress = Array.isArray(cartItem.user?.addresses)
      ? cartItem.user?.addresses.find(
        (address: any) => address._id?.toString() === cartItem.addressId?.toString()
      )
      : undefined;

    cartItem.selectedTierId = selectedTier || null;
    cartItem.addressId = selectedAddress || undefined;

    // ✅ Calculate discounted price
    const discount = cartItem.event?.discount || 0;
    const basePrice = selectedTier?.price || 0;
    cartItem.discountedPrice = this.calculateDiscountedPrice(basePrice, discount);

    // ✅ Calculate total including add-ons and planner price
    let itemTotal = cartItem.discountedPrice;
    if (Array.isArray(cartItem.addOnIds) && cartItem.addOnIds.length > 0) {
      const addOnsTotal = cartItem.addOnIds.reduce((sum: number, addOn: any) => {
        const qty = addOn.quantity || 1;
        return sum + (addOn.price || 0) * qty;
      }, 0);
      itemTotal += addOnsTotal;
    }
    if (cartItem.plannerPrice) itemTotal += cartItem.plannerPrice;

    cartItem.itemTotal = itemTotal;

    // ✅ Clean up unnecessary fields
    if (cartItem.event) delete cartItem.event.tiers;
    if (cartItem.user) delete cartItem.user.addresses;

    return cartItem;
  }


  /** ---------------- GET MY CART ---------------- */
  async getMyCart(userId: string) {
    const cartItem: any = await this.cartModel
      .findOne({ user: userId })
      .populate('user', 'name email addresses firstName lastName mobile')
      .populate('event')
      .populate('selectedTierId')
      .populate('addOnIds', 'name description price maxQuantity')
      .lean();

    if (!cartItem || !cartItem.event || !cartItem.selectedTierId) return null;

    const selectedTier = cartItem.event.tiers.find(
      (tier: any) => tier._id.toString() === cartItem.selectedTierId.toString(),
    );
    const selectedAddress = cartItem.user.addresses.find(
      (address: any) => address._id?.toString() === cartItem.addressId?.toString()
    );
    cartItem.selectedTierId = selectedTier || null;
    cartItem.addressId = selectedAddress || undefined;

    const discount = cartItem.event?.discount || 0;
    const price = selectedTier?.price || 0;
    cartItem.discountedPrice = this.calculateDiscountedPrice(price, discount);

    let itemTotal = cartItem.discountedPrice;
    if (Array.isArray(cartItem.addOnIds) && cartItem.addOnIds.length > 0) {
      const addOnsTotal = cartItem.addOnIds.reduce((sum: number, addOn: any) => {
        const qty = addOn.quantity || 1;
        return sum + (addOn.price || 0) * qty;
      }, 0);
      itemTotal += addOnsTotal;
    }
    if (cartItem.plannerPrice) itemTotal += cartItem.plannerPrice;

    cartItem.itemTotal = itemTotal;

    delete cartItem.event.tiers;
    delete cartItem.user.addresses;

    return cartItem;
  }

  /** ---------------- PLANNER PRICE ---------------- */
  async getPlannerPrice(userId: string) {
    const cartItem: any = await this.cartModel
      .findOne({ user: userId })
      .populate('event')
      .lean();

    if (!cartItem) throw new NotFoundException('Cart not found');

    const selectedTier = cartItem.event.tiers.find(
      (tier: any) => tier._id.toString() === cartItem.selectedTierId.toString(),
    );

    const discount = cartItem.event?.discount || 0;
    const price = selectedTier?.price || 0;
    let discountedPrice = this.calculateDiscountedPrice(price, discount);

    if (Array.isArray(cartItem.addOnIds) && cartItem.addOnIds.length > 0) {
      const addOnsTotal = cartItem.addOnIds.reduce((sum: number, addOn: any) => {
        const qty = addOn.quantity || 1;
        return sum + (addOn.price || 0) * qty;
      }, 0);
      discountedPrice += addOnsTotal;
    }

    const plannerPrice = discountedPrice * 0.08;
    if (plannerPrice < 3000) return { plannerPrice: 3000 };
    if (plannerPrice > 15000) return { plannerPrice: 15000 };
    return { plannerPrice };
  }

  /** ---------------- REMOVE ITEM ---------------- */
  async removeCartItem(cartId: string, userId: string) {
    const deleted = await this.cartModel.findOneAndDelete({
      _id: cartId,
      user: userId,
    });
    if (!deleted) throw new NotFoundException('Cart item not found');
    return { success: true };
  }

  async clearCart(userId: string) {
    await this.cartModel.deleteMany({ user: userId, status: 'active' });
    return { success: true };
  }

  /** ---------------- UPGRADE SUGGESTIONS ---------------- */
  async getUpgradeSuggestions(userId: string) {
    const cart = await this.cartModel
      .findOne({ user: userId })
      .populate<{ event: BirthdayEvent }>('event')
      .lean();

    if (!cart) throw new NotFoundException('Cart not found');
    if (!cart.event) throw new NotFoundException('Event not found');

    const tiers = cart.event.tiers || [];
    const currentIndex = tiers.findIndex(
      (t: any) => t._id.toString() === cart.selectedTierId.toString(),
    );

    if (currentIndex === -1) throw new NotFoundException('Tier not found');

    const currentTier = tiers[currentIndex];
    const suggestions = tiers.slice(currentIndex + 1).map((t: any) => ({
      _id: t._id,
      name: t.name,
      price: t.price,
      guest: t.guest,
      description: t.description,
      features: t.features,
      priceDifference: t.price - currentTier.price,
    }));

    return { upgradeOptions: suggestions };
  }

  /** ---------------- PREVIEW COUPON ---------------- */
  async previewCoupon(cartId: string, dto: { couponId: string }) {
    const cart = await this.cartModel.findById(cartId).populate('event').lean<Cart>();
    if (!cart) throw new NotFoundException('Cart not found');
    if (!dto.couponId) throw new BadRequestException('Coupon is required');

    const coupon = await this.couponModel.findOne({ code: dto.couponId }).lean<Coupon>();
    if (!coupon) throw new BadRequestException('Invalid coupon');
    if (!coupon.isActive) throw new BadRequestException('Coupon is inactive');
    if (new Date(coupon.expiryDate) < new Date())
      throw new BadRequestException('Coupon has expired');
    if (coupon.maxUsage !== undefined && coupon.usageCount >= coupon.maxUsage)
      throw new BadRequestException('Coupon usage limit reached');

    if (typeof cart.itemTotal !== 'number' || typeof cart.discountedPrice !== 'number')
      throw new BadRequestException('Cart total/discounted price missing');

    const itemTotal = cart.itemTotal;
    const basePrice = cart.discountedPrice;

    let discountAmount = 0;
    let discountedTotal = basePrice;
    let extraMessage = '';

    if (coupon.discountType === 'percentage') {
      discountAmount = basePrice * (coupon.discountValue / 100);

      if (coupon.maxDiscount !== undefined) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount, basePrice);
      }

      discountedTotal = Math.max(0, itemTotal - discountAmount);
    } else if (coupon.discountType === 'fixed') {
      const minAmount = coupon.minimumAmount || 0;

      if (basePrice >= minAmount) {
        discountAmount = coupon.discountValue;
        discountedTotal = Math.max(0, itemTotal - discountAmount);
      } else {
        const difference = minAmount - basePrice;
        extraMessage = `Add ₹${difference.toFixed(2)} more to apply this coupon`;
      }
    }

    // ✅ Round all money values to 2 decimals
    const round2 = (val: number) => Number(val.toFixed(2));

    return {
      originalTotal: round2(itemTotal),
      discountedBase: round2(basePrice),
      discount: round2(discountAmount),
      finalTotal: round2(discountedTotal),
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minimumAmount: coupon.minimumAmount,
        maxDiscount: coupon.maxDiscount,
      },
      message: extraMessage || 'Coupon preview applied (not saved to cart)',
    };
  }



}
