import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from './review.schema';
import { Order, OrderSchema } from '../order/order.schema';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';


@Module({
    imports: [MongooseModule.forFeature([
        { name: Review.name, schema: ReviewSchema },
        { name: Order.name, schema: OrderSchema },
    ])],
    controllers: [ReviewController],
    providers: [ReviewService],
})
export class ReviewModule { }