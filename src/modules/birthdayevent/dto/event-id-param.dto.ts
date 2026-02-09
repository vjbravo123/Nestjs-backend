import { IsMongoId } from 'class-validator';

export class EventIdParamDto {
    @IsMongoId({ message: 'Invalid eventId: must be a valid MongoDB ObjectId' })
    eventId: string;
} 