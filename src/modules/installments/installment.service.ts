import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import {
    InstallmentSchedule,
    InstallmentScheduleDocument,
} from './installment.schema';
import { PaymentMilestoneService } from '../booking-payments/payment-milestone/payment-milestone.service';
import { Type } from '@aws-sdk/client-s3';
import { UserInstallmentQueryDto } from './dto/user-installment-query.dto'

interface InstallmentEntry {
    installmentNumber: number;
    percentage: number;
    amount: number;
    dueDate: Date;
    status: string;
    paidAt?: Date;
    transactionId?: string;
}

@Injectable()
export class InstallmentService {
    constructor(
        @InjectModel(InstallmentSchedule.name)
        private readonly installmentModel: Model<InstallmentScheduleDocument>,
        private readonly milestoneService: PaymentMilestoneService,
    ) { }


    private buildInstallmentsFromMilestone(
        totalAmount: number,
        alreadyPaidAmount: number,
        milestones: { percentage: number; daysRemaining: number }[],
        eventDate: Date,
        transactionId?: string,
    ) {

        const schedule: InstallmentEntry[] = [];

        let cumulativePercent = 0;
        let installmentCounter = 1;
        let paidTracker = alreadyPaidAmount;

        // Sort milestones by daysRemaining DESC (important)
        const sortedMilestones = [...milestones].sort(
            (a, b) => b.daysRemaining - a.daysRemaining,
        );

        for (const milestone of sortedMilestones) {

            cumulativePercent += milestone.percentage;

            const cumulativeTargetAmount =
                (totalAmount * cumulativePercent) / 100;

            const remainingForThisLevel =
                cumulativeTargetAmount - paidTracker;

            if (remainingForThisLevel <= 0) {
                continue; // Already satisfied
            }

            const dueDate = new Date(eventDate);
            dueDate.setDate(
                dueDate.getDate() - milestone.daysRemaining,
            );

            schedule.push({
                installmentNumber: installmentCounter++,
                percentage: milestone.percentage,
                amount: Math.round(remainingForThisLevel),
                dueDate,
                status: 'pending',
            });

            paidTracker += remainingForThisLevel;
        }

        return schedule;
    }

    async createInstallmentScheduleFromPaymentOption(
        params: {
            userId: Types.ObjectId;
            checkoutBatchId: Types.ObjectId;
            totalAmount: number;
            eventDate: Date;
            payAmountPercent: number; // 100, 70, 50 etc
            paymentOption: string;    // MINIMUM, CUSTOM, FULL
            transactionId?: string;
        },
        session?: ClientSession, // 🔥 optional session
    ) {


        const {
            userId,
            checkoutBatchId,
            totalAmount,
            eventDate,
            payAmountPercent,
            paymentOption,
            transactionId,
        } = params;

        // Safety
        if (payAmountPercent <= 0 || payAmountPercent > 100) {
            throw new BadRequestException('Invalid payment percent');
        }

        const paidAmount = Math.round(
            (totalAmount * payAmountPercent) / 100,
        );

        /*
          ==========================================
          CASE 1: FULL PAYMENT (100%)
          ==========================================
        */
        if (payAmountPercent === 100) {

            return this.installmentModel.create({
                userId: new Types.ObjectId(userId),
                checkoutBatchId,
                totalAmount,
                paidAmount: totalAmount,
                installments: [
                    {
                        installmentNumber: 1,
                        percentage: 100,
                        amount: totalAmount,
                        dueDate: new Date(), // can be null if you prefer
                        status: 'paid',
                        paidAt: new Date(),
                        transactionId,
                    },
                ],
            });
        }

        /*
          ==========================================
          CASE 2: PARTIAL / MINIMUM / CUSTOM
          ==========================================
        */

        const milestoneConfigs = await this.milestoneService.getAll();

        if (!milestoneConfigs.length) {
            throw new NotFoundException('Payment milestone config not found');
        }

        const milestones = milestoneConfigs[0].milestonesData;

        const sortedMilestones = [...milestones].sort(
            (a, b) => b.daysRemaining - a.daysRemaining,
        );

        const installments: InstallmentEntry[] = [];

        let cumulativePercent = 0;
        let paidTracker = paidAmount;
        let installmentCounter = 1;

        for (const milestone of sortedMilestones) {

            cumulativePercent += milestone.percentage;

            const cumulativeTargetAmount =
                (totalAmount * cumulativePercent) / 100;

            const remainingAmount =
                cumulativeTargetAmount - paidTracker;

            if (remainingAmount <= 0) continue;

            const dueDate = new Date(eventDate);
            dueDate.setDate(
                dueDate.getDate() - milestone.daysRemaining,
            );

            installments.push({
                installmentNumber: installmentCounter++,
                percentage: milestone.percentage,
                amount: Math.round(remainingAmount),
                dueDate,
                status: 'pending',
            });

            paidTracker += remainingAmount;
        }

        /*
          Add initial paid record (optional but recommended)
        */

        installments.unshift({
            installmentNumber: 0,
            percentage: payAmountPercent,
            amount: paidAmount,
            dueDate: new Date(),
            status: 'paid',
            paidAt: new Date(),
            transactionId,
        });

        return this.installmentModel.create({
            userId: new Types.ObjectId(userId),
            checkoutBatchId,
            totalAmount,
            paidAmount,
            installments,
        });
    }





    /* =========================================================
       CREATE / REGENERATE INSTALLMENTS AFTER PAYMENT
       ========================================================= */
    async createSchedule(userId: string, dto: any) {

        const milestoneConfigs = await this.milestoneService.getAll();
        if (!milestoneConfigs.length) {
            throw new NotFoundException('Milestone config not found');
        }

        const milestones = milestoneConfigs[0].milestonesData;

        const installments = this.buildInstallments(
            dto.totalAmount,
            dto.initialPaidAmount,
            milestones,
            new Date(dto.eventDate),
            dto.transactionId,
        );

        await this.installmentModel.deleteOne({
            checkoutBatchId: dto.checkoutBatchId,
        });

        return this.installmentModel.create({
            userId: new Types.ObjectId(userId),
            checkoutBatchId: dto.checkoutBatchId,
            totalAmount: dto.totalAmount,
            paidAmount: dto.initialPaidAmount,
            installments,
        });
    }

    /* =========================================================
       CORE RECONCILIATION ENGINE
       ========================================================= */
    private buildInstallments(
        totalAmount: number,
        alreadyPaid: number,
        milestones: any[],
        eventDate: Date,
        transactionId?: string,
    ) {
        const schedule: {
            installmentNumber: number;
            percentage: number;
            amount: number;
            dueDate: Date;
            status: string;
            paidAt?: Date;
            transactionId?: string;
        }[] = [];
        let cumulativePercent = 0;
        let installmentCounter = 1;
        let paidTracker = alreadyPaid;

        const sortedMilestones = [...milestones].sort(
            (a, b) => b.daysRemaining - a.daysRemaining,
        );

        // Store already paid record
        if (alreadyPaid > 0) {
            schedule.push({
                installmentNumber: 0,
                percentage: 0,
                amount: alreadyPaid,
                dueDate: new Date(),
                status: 'paid',
                paidAt: new Date(),
                transactionId,
            });
        }

        for (const milestone of sortedMilestones) {
            cumulativePercent += milestone.percentage;

            const cumulativeTargetAmount =
                (totalAmount * cumulativePercent) / 100;

            const remainingAmount =
                cumulativeTargetAmount - paidTracker;

            if (remainingAmount <= 0) continue;

            const dueDate = new Date(eventDate);
            dueDate.setDate(
                dueDate.getDate() - milestone.daysRemaining,
            );

            schedule.push({
                installmentNumber: installmentCounter++,
                percentage: milestone.percentage,
                amount: Math.round(remainingAmount),
                dueDate,
                status: 'pending',
            });

            paidTracker += remainingAmount;
        }

        return schedule;
    }

    /* =========================================================
       MARK INSTALLMENT PAID
       ========================================================= */
    async markInstallmentPaid(dto: any) {
        const schedule = await this.installmentModel.findOne({
            checkoutBatchId: dto.checkoutBatchId,
        });

        if (!schedule)
            throw new NotFoundException('Installment schedule not found');

        const installment = schedule.installments.find(
            (i) => i.installmentNumber === dto.installmentNumber,
        );

        if (!installment)
            throw new NotFoundException('Installment not found');

        if (installment.status === 'paid')
            throw new BadRequestException('Already paid');

        installment.status = 'paid';
        installment.paidAt = new Date();
        installment.transactionId = dto.transactionId;

        schedule.paidAmount += installment.amount;

        schedule.markModified('installments');

        return schedule.save();
    }

    /* =========================================================
       GET BY BOOKING
       ========================================================= */
    async getByBooking(bookingId: string) {
        const schedule = await this.installmentModel.findOne({ bookingId }).lean();
        if (!schedule)
            throw new NotFoundException('Installment schedule not found');
        return schedule;
    }

    /* =========================================================
       GET USER INSTALLMENTS
       ========================================================= */
    async getUserInstallments(userId: string) {
        return this.installmentModel
            .find({ userId: new Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .lean()
            .exec();
    }


    async getAllForAdminWithQuery(options: any = {}) {
        const {
            page = 1,
            limit = 10,
            sortBy,
            populate,
            search,
            userId,
            status,
            fromDate,
            checkoutBatchId,
            toDate,
            isPaid,
        } = options;

        // ✅ Always build fresh mongo filter
        const mongoFilter: any = {};

        // -----------------------------------
        // 🔎 SEARCH FILTER
        // -----------------------------------
        if (search) {
            mongoFilter.$or = [
                { scheduleName: { $regex: search, $options: 'i' } },
                { status: { $regex: search, $options: 'i' } },
            ];
        }

        // -----------------------------------
        // 📅 DATE RANGE FILTER
        // -----------------------------------
        if (fromDate || toDate) {
            mongoFilter.createdAt = {};

            if (fromDate) {
                mongoFilter.createdAt.$gte = new Date(fromDate);
            }

            if (toDate) {
                mongoFilter.createdAt.$lte = new Date(toDate);
            }
        }

        // -----------------------------------
        // ✅ BOOLEAN FILTER
        // -----------------------------------
        if (typeof isPaid === 'boolean') {
            mongoFilter.isPaid = isPaid;
        }

        // -----------------------------------
        // ✅ STATUS FILTER
        // -----------------------------------
        if (status) {
            mongoFilter.status = status;
        }
        if (checkoutBatchId) {
            mongoFilter.checkoutBatchId = checkoutBatchId;
        }
        // -----------------------------------
        // 👤 USER FILTER
        // -----------------------------------
        if (userId) {
            mongoFilter.userId = new Types.ObjectId(userId);
        }

        console.log('Paginate final filter data:', mongoFilter);

        // -----------------------------------
        // 🚀 PAGINATION
        // -----------------------------------
        return (this.installmentModel as any).paginate(mongoFilter, {
            page: Number(page),
            limit: Number(limit),
            sortBy,
            populate:
                populate ||
                'userId:name email mobile firstName lastName',
        });
    }

    async getInstallmentsForUser(
        userId: Types.ObjectId,
        query: UserInstallmentQueryDto,
    ) {

        const {
            checkoutBatchId,
            status,
            minAmount,
            maxAmount,
            fromDate,
            toDate,
            page = 1,
            limit = 10,
            sortBy = 'createdAt:desc',
        } = query;

        const filter: any = {
            userId: new Types.ObjectId(userId),
        };

        if (checkoutBatchId) {
            filter.checkoutBatchId = checkoutBatchId;
        }

        // Nested installment filtering
        if (status) {
            filter['installments.status'] = status;
        }

        if (minAmount || maxAmount) {
            filter['installments.amount'] = {};
            if (minAmount)
                filter['installments.amount'].$gte = minAmount;
            if (maxAmount)
                filter['installments.amount'].$lte = maxAmount;
        }

        if (fromDate || toDate) {
            filter['installments.dueDate'] = {};
            if (fromDate)
                filter['installments.dueDate'].$gte = new Date(fromDate);
            if (toDate)
                filter['installments.dueDate'].$lte = new Date(toDate);
        }

        const [sortField, sortOrder] = sortBy.split(':');
        const sort = {
            [sortField]: sortOrder === 'asc' ? 1 : -1,
        };

        const options = {
            page,
            limit,
            sort,
            lean: true,
        };

        const result = await (this.installmentModel as any).paginate(
            filter,
            options,
        );

        return result
    }

}
