import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Commission, CommissionDocument } from './commission.schema';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { CreateCommissionDto } from './dto/create-commission.dto';

@Injectable()
export class CommissionService {
    constructor(
        @InjectModel(Commission.name) private commissionModel: Model<CommissionDocument>
    ) { }

   private calculatePricing(tier: any) {
    const basePrice = tier.basePrice;

    const calculateFeeAmount = (feeConfig: any) => ({
        user: feeConfig.type === 'percentage' ? (basePrice * feeConfig.userCharge) / 100 : feeConfig.userCharge,
        vendor: feeConfig.type === 'percentage' ? (basePrice * feeConfig.vendorCharge) / 100 : feeConfig.vendorCharge
    });

    const platformFee = calculateFeeAmount(tier.platformFee);
    const zappyCommission = calculateFeeAmount(tier.zappyCommission);
    const totalAdditionalCharges = tier.additionalCharges?.reduce((sum: number, charge: any) => sum + Number(charge.amount), 0) || 0;

    // The base amounts on which GST is calculated
    const userTaxableBase = basePrice + platformFee.user + zappyCommission.user;
    const vendorTaxableBase = basePrice + platformFee.vendor + zappyCommission.vendor + totalAdditionalCharges;

    // The main GST amounts
    const userMainGst = (userTaxableBase * tier.gst.userCharge) / 100;
    const vendorMainGst = (vendorTaxableBase * tier.gst.vendorCharge) / 100;

    // Subtotals after base fees and main GST are applied
    const userSubtotalWithGst = userTaxableBase + userMainGst;
    const vendorSubtotalWithGst = basePrice - platformFee.vendor - zappyCommission.vendor - totalAdditionalCharges - vendorMainGst;

    // Gateway Fees (Calculated on the subtotal that includes GST)
    const userGatewayFee = tier.gatewayFee.type === 'percentage' 
        ? (userSubtotalWithGst * tier.gatewayFee.userCharge) / 100 
        : tier.gatewayFee.userCharge;
        
    const vendorGatewayFee = tier.gatewayFee.type === 'percentage' 
        ? (vendorSubtotalWithGst * tier.gatewayFee.vendorCharge) / 100 
        : tier.gatewayFee.vendorCharge;

    // GST specifically on the Gateway Fees
    const userGatewayGst = tier.gatewayFee.includeGST ? (userGatewayFee * tier.gst.userCharge) / 100 : 0;
    const vendorGatewayGst = tier.gatewayFee.includeGST ? (vendorGatewayFee * tier.gst.vendorCharge) / 100 : 0;

    // Final Outputs
    return {
        userPayment: userSubtotalWithGst + userGatewayFee + userGatewayGst,
        
        vendorPayout: vendorSubtotalWithGst - vendorGatewayFee - vendorGatewayGst,
        
        adminProfit: (platformFee.user + platformFee.vendor) + 
                     (zappyCommission.user + zappyCommission.vendor) + 
                     (userGatewayFee + vendorGatewayFee) + 
                     totalAdditionalCharges + 
                     (userMainGst + vendorMainGst + userGatewayGst + vendorGatewayGst)
    };
}
    async createCommission(type: string, id: Types.ObjectId | string, dto: CreateCommissionDto): Promise<CommissionDocument> {
        const objectId = new Types.ObjectId(id);
        const query = type === 'event' ? { eventId: objectId } : { serviceId: objectId };

        const existingCommission = await this.commissionModel.findOne(query).exec();
        if (existingCommission) {
            throw new ConflictException(`Commission configuration already exists for this ${type}. Use PATCH to update.`);
        }

        // Apply calculations directly to incoming tiers
        dto.tiers.forEach(tier => {
            tier.totalAdditionalCharges = tier.additionalCharges?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
            tier.pricing = this.calculatePricing(tier);
        });

        return this.commissionModel.create({
            ...dto,
            ...query 
        });
    }

    async getCommission(type: string, id: Types.ObjectId | string): Promise<CommissionDocument> {
        const objectId = new Types.ObjectId(id);
        const query = type === 'event' ? { eventId: objectId } : { serviceId: objectId };

        const commission = await this.commissionModel.findOne(query).exec();
        if (!commission) throw new NotFoundException(`Commission configuration not found for this ${type}`);
        
        return commission;
    }

   async updateCommissionConfig(type: string, id: Types.ObjectId | string, updateCommissionDto: UpdateCommissionDto): Promise<CommissionDocument> {
    const commission = await this.getCommission(type, id);
    
    // Early exit if there are no tiers to update
    if (!updateCommissionDto.tiers?.length) {
        return commission; 
    }

    for (const incomingTier of updateCommissionDto.tiers) {
        if (!incomingTier.tierId) continue;
        
        const index = commission.tiers.findIndex(t => t.tierId === incomingTier.tierId);
        const existingTier = index > -1 ? commission.tiers[index] : null;

        // 1. Merge existing data with incoming data (or just use incoming if it's a new tier)
        const mergedTier = { 
            ...(existingTier ? (existingTier as any).toObject() : {}), 
            ...incomingTier 
        };

        // 2. Perform calculations exactly once
        mergedTier.totalAdditionalCharges = mergedTier.additionalCharges?.reduce((sum: number, c: any) => sum + Number(c.amount), 0) || 0;
        mergedTier.pricing = this.calculatePricing(mergedTier);

        // 3. Save back to the array
        if (existingTier) {
            (commission.tiers[index] as any).set(mergedTier); 
        } else {
            commission.tiers.push(mergedTier as any);
        }
    }
    
    commission.markModified('tiers');
    return commission.save();
}
}