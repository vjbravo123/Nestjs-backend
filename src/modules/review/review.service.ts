import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './review.schema';
import { Order, OrderDocument } from '../order/order.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { AdminUpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) { }

  async create(dto: CreateReviewDto, userId: string) {
    // Ensure IDs are in ObjectId format
    const orderObjectId = new Types.ObjectId(dto.orderId);
    const eventObjectId = new Types.ObjectId(dto.event);
    const userObjectId = userId;

    // Check if order exists for this user & event
    const order = await this.orderModel.findOne({
      _id: dto.orderId,
      user: userObjectId,
      'event._id': eventObjectId, // Assuming event is embedded in Order
    });

    if (!order) {
      throw new BadRequestException('Order not found or does not belong to user');
    }

    // Optional: prevent duplicate reviews for same order
    const existingReview = await this.reviewModel.findOne({
      orderId: orderObjectId,
      user: userObjectId,
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this order');
    }

    // Create review
    const review = new this.reviewModel({
      ...dto,
      orderId: orderObjectId,
      event: eventObjectId,
      user: userObjectId,
    });

    return review.save();
  }

  async getByEvent(eventId: string) {
    return this.reviewModel
      .find({ event: new Types.ObjectId(eventId) })
      .populate('user', 'firstName lastName')
      .exec();
  }
  async getReviews(options: any = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy,
      populate,
      filters = {},
    } = options;

    const query: any = { ...filters };

    // Apply specific filter handling
    if (query.status) {
      query.status = query.status; // 'pending' | 'approve' | 'reject'
    }

    if (query.rating) {
      query.rating = Number(query.rating);
    }

    if (query.user) {
      query.user = query.user; // ObjectId string
    }

    if (query.event) {
      query.event = query.event; // ObjectId string
    }

    if (query.orderId) {
      query.orderId = query.orderId;
    }

    // Default populate (can be overridden via query param)
    // const populateOptions = populate ||
    console.log("query", query)

    return (this.reviewModel as any).paginate(query, {
      page: Number(page),
      limit: Number(limit),
      sortBy,
      // populate: populateOptions,
    });
  }

  async getEventOverallRating(eventId: string) {
    const result = await this.reviewModel.aggregate([
      { $match: { event: new this.reviewModel.db.base.Types.ObjectId(eventId), status: 'pending' } }, // only approved reviews
      {
        $group: {
          _id: '$event',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (result.length === 0) {
      return { eventId, averageRating: 0, totalReviews: 0 };
    }

    return {
      eventId,
      averageRating: Number(result[0].averageRating.toFixed(1)), // e.g., 4.3
      totalReviews: result[0].totalReviews,
    };
  }
  async adminUpdateReview(
    reviewId: string,
    dto: AdminUpdateReviewDto,
    adminId: string,   // we also pass who updated
  ) {
    const review = await this.reviewModel.findByIdAndUpdate(
      reviewId,
      {
        $set: {
          ...dto,
          updatedBy: adminId, // optional: track who changed it
        }
      },
      { new: true },
    );

    if (!review) {
      throw new NotFoundException(`Review with id ${reviewId} not found`);
    }

    return {
      message: 'Review updated successfully',
      review,
    };
  }


}



