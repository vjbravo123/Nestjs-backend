// src/common/pipes/mongo-id.pipe.ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class MongoIdPipe implements PipeTransform {
    transform(value: any) {
        if (!value || !Types.ObjectId.isValid(value)) {
            throw new BadRequestException('Invalid or missing ObjectId');
        }
        return new Types.ObjectId(value);
    }
}
