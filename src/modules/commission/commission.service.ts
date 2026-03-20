import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Commission, CommissionDocument } from './commission.schema';
import { CreateCommissionDto } from './dto/create-commission.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { CommissionPricingService } from './commission-pricing.service';
import { CommissionType } from './enums/commission-type.enum';

@Injectable()
export class CommissionService {
    constructor(
        @InjectModel(Commission.name)
        private readonly model: Model<CommissionDocument>,
        private readonly pricingService: CommissionPricingService,
    ) { }

    private buildQuery(type: CommissionType, id: Types.ObjectId) {
        return type === CommissionType.EVENT
            ? { eventId: id }
            : { serviceId: id };
    }

    async create(
        type: CommissionType,
        id: Types.ObjectId,
        dto: CreateCommissionDto,
    ) {
        const exists = await this.model.findOne(this.buildQuery(type, id));
        if (exists) throw new ConflictException('Commission already exists');

        const tiers = dto.tiers.map((tier) => ({
            ...tier,
            tierId: new Types.ObjectId(tier.tierId),
            pricing: this.pricingService.calculate(tier as any),
        }));

        return this.model.create({ ...this.buildQuery(type, id), tiers });
    }

    async getCommissionWithQuery(
        type: CommissionType,
        id: Types.ObjectId,
        query?: { tierId?: Types.ObjectId; tierName?: string },
    ) {
        const { tierId, tierName } = query || {};
        console.log(type , id ,query);
        
        const commission = await this.model.findOne(
            this.buildQuery(type, id),
        );

        if (!commission) {
            throw new NotFoundException('Commission not found');
        }

        // ✅ No filter → return full commission
        if (!tierId && !tierName) {
            return commission;
        }

        // ✅ Prevent ambiguous query
        if (tierId && tierName) {
            throw new BadRequestException(
                'Provide either tierId or tierName, not both',
            );
        }

        const tier = commission.tiers.find((t) => {
            if (tierId) return t.tierId?.equals(tierId);
            if (tierName) return t.tierName === tierName;
            return false;
        });

        if (!tier) {
            throw new NotFoundException('Tier not found');
        }

        return tier;
    }

    async update(
        type: CommissionType,
        id: Types.ObjectId,
        dto: UpdateCommissionDto,
    ) {
        const commission = await this.model.findOne(this.buildQuery(type, id));

        if (!commission) {
            throw new NotFoundException('Commission not found');
        }

        if (!dto.tiers?.length) {
            return commission;
        }

        /**
         * Create quick lookup for existing tiers
         */
        const existingTierMap = new Map(
            commission.tiers.map((tier) => [tier.tierId, tier]),
        );
        console.log("existingTierMap from db", existingTierMap)
        for (const incomingTier of dto.tiers) {
            const totalAdditionalCharges =
                incomingTier.additionalCharges?.reduce(
                    (sum, c) => sum + Number(c.amount),
                    0,
                ) ?? 0;

            const preparedTier = {
                ...incomingTier,
                totalAdditionalCharges,
                pricing: this.pricingService.calculate({
                    ...incomingTier,
                    totalAdditionalCharges,
                } as any),
            };

            /**
             * If tier exists → replace
             */
            if (existingTierMap.has(incomingTier.tierId)) {
                const index = commission.tiers.findIndex(
                    (t) => t.tierId === incomingTier.tierId,
                );

                commission.tiers[index] = preparedTier as any;
            } else {
                /**
                 * If tier does NOT exist → create new tier
                 */
                commission.tiers.push(preparedTier as any);
            }
        }

        return commission.save();
    }
}