import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ExperientialEventService } from './experientialevent.service';

@Injectable()
export class EventOwnerGuard implements CanActivate {
    constructor(private readonly experientialeventService: ExperientialEventService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        const eventId = req.params.eventId;


        // 1️⃣ Fetch event by ID
        const event = await this.experientialeventService.getById(eventId);
        if (!event) throw new NotFoundException('Event not found');

        // 2️⃣ Optionally attach event to request to reuse later
        req.event = event;

        console.log("event.createdBy.toString(): ", event.createdBy.toString());
        console.log("user.vendorId: ", user.vendorId);
        // 4️⃣ Vendor can only access their own events
        if (event.createdBy.toString() !== user.vendorId.toString()) {
            throw new ForbiddenException('You are not authorized to access this event');
        }

        return true;
    }
}
