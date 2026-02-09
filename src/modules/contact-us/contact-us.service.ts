import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContactUs } from './schemas/contact-us.schema';
import { CreateContactUsDto } from './dto/create-contact-us.dto';
import { AdminListContactUsDto } from './dto/admin-list-contact-us.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import logger from '../../common/utils/logger';

@Injectable()
export class ContactUsService {
    constructor(
        @InjectModel(ContactUs.name)
        private readonly contactUsModel: Model<ContactUs>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    // ─────────── User: Create Contact Request ───────────
    async create(dto: CreateContactUsDto) {
        const startTime = Date.now();

        logger.info(
            `[ContactUs] Creating new contact request | email=${dto.email} | mobile=${dto.mobile} | city=${dto.city}`,
        );

        const contact = await this.contactUsModel.create(dto);
        const contactId = contact.id.toString();

        logger.info(
            `[ContactUs] Contact created successfully | contactId=${contactId} | duration=${Date.now() - startTime}ms`,
        );

        // 🔔 Emit Event for WhatsApp notification
        logger.info(
            `[ContactUs] Emitting 'contactus.created' event | contactId=${contactId}`,
        );

        this.eventEmitter.emit('contactus.created', {
            contactId,
            fullName: contact.fullName, // ✅ CORRECT
            email: contact.email,
            mobile: contact.mobile,
            city: contact.city,
            message: contact.message,
            createdAt: new Date().toISOString(),
        });

        logger.info(
            `[ContactUs] Event emitted successfully | contactId=${contactId}`,
        );

        return contact;
    }

    // ─────────── Admin: List with Filters ───────────
    async getAll(query: AdminListContactUsDto) {
        const {
            page = 1,
            limit = 20,
            city,
            email,
            mobile,
        } = query;

        const filter: any = {};
        if (city) filter.city = city;
        if (email) filter.email = email;
        if (mobile) filter.mobile = mobile;

        const options = {
            page,
            limit,
            sortBy: 'createdAt:desc',
        };

        return (this.contactUsModel as any).paginate(filter, options);

    }

}
