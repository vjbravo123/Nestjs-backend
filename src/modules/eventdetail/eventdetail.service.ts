import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventDetail, EventDetailDocument } from './eventdetail.schema';
import { CreateEventDetailDto } from './dto/create-eventdetail.dto';

@Injectable()
export class EventDetailService {
    constructor(
        @InjectModel(EventDetail.name) private eventDetailModel: Model<EventDetailDocument>
    ) { }

    async create(dto: CreateEventDetailDto, admin: any) {
        // Optionally, you can store createdBy: admin._id if needed
        const detail = new this.eventDetailModel({ ...dto });
        return detail.save();
    }

    async getByType(type?: string) {
        if (type) {
            return this.eventDetailModel.find({ type }).exec();
        }
        return this.eventDetailModel.find().exec();
    }
}