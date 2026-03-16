import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TierConfig } from './commission.schema';
import { PricingSummary } from './interfaces/pricing.interface';

@Injectable()
export class CommissionPricingService {
    private round(value: Decimal): number {
        return Number(value.toDecimalPlaces(2));
    }

    calculate(tier: TierConfig): PricingSummary {
        const base = new Decimal(tier.basePrice);

        const calcFee = (fee: any, amount: Decimal) => {
            if (fee.type === 'percentage') {
                return {
                    user: amount.mul(fee.userCharge).div(100),
                    vendor: amount.mul(fee.vendorCharge).div(100),
                };
            }
            return {
                user: new Decimal(fee.userCharge || 0),
                vendor: new Decimal(fee.vendorCharge || 0),
            };
        };

        /* ---------------- ADDITIONAL CHARGES ---------------- */

        const additional = (tier.additionalCharges || []).reduce(
            (sum, c) => sum.plus(c.amount),
            new Decimal(0),
        );

        /* ---------------- PLATFORM & ZAPPY ON BASE ---------------- */

        const platform = calcFee(tier.platformFee, base);
        const zappy = calcFee(tier.zappyCommission, base);

        /* ---------------- USER SIDE ---------------- */

        // Subtotal = Base + Platform + Zappy + Additional
        const subtotal = base
            .plus(platform.user)
            .plus(zappy.user)
            .plus(additional);

        // GST calculated on subtotal
        const gstAmount = subtotal.mul(tier.gst.userCharge).div(100);

        const amountWithGst = subtotal.plus(gstAmount);

        // Gateway calculated on amount WITH GST
        const gateway = calcFee(tier.gatewayFee, amountWithGst);

        const userPayment = amountWithGst.plus(gateway.user);

        /* ---------------- VENDOR SIDE ---------------- */

        const vendorTaxBase = base
            .plus(platform.vendor)
            .plus(zappy.vendor)
            .plus(additional);

        const vendorGst = vendorTaxBase.mul(tier.gst.vendorCharge).div(100);

        const vendorPayout = base
            .minus(platform.vendor)
            .minus(zappy.vendor)
            .minus(gateway.vendor)
            .minus(vendorGst)
            .minus(additional);

        /* ---------------- ADMIN PROFIT ---------------- */

        const adminProfit = userPayment.minus(vendorPayout);

        return {
            userPayment: this.round(userPayment),
            vendorPayout: this.round(vendorPayout),
            adminProfit: this.round(adminProfit),
        };
    }
}




// import { Injectable } from '@nestjs/common';
// import Decimal from 'decimal.js';
// import { TierConfig } from './commission.schema';
// import { PricingSummary } from './interfaces/pricing.interface';

// @Injectable()
// export class CommissionPricingService {
//   private round(value: Decimal): number {
//     return Number(value.toDecimalPlaces(2));
//   }

//   /**
//    * Generic fee calculator (percentage or flat)
//    */
//   private calculateFee(
//     fee: any,
//     amount: Decimal,
//   ): { user: Decimal; vendor: Decimal } {
//     if (!fee) {
//       return { user: new Decimal(0), vendor: new Decimal(0) };
//     }

//     if (fee.type === 'percentage') {
//       return {
//         user: amount.mul(fee.userCharge || 0).div(100),
//         vendor: amount.mul(fee.vendorCharge || 0).div(100),
//       };
//     }

//     return {
//       user: new Decimal(fee.userCharge || 0),
//       vendor: new Decimal(fee.vendorCharge || 0),
//     };
//   }

//   calculate(tier: TierConfig): PricingSummary {
//     const base = new Decimal(tier.basePrice);

//     /* ---------------- ADDITIONAL ---------------- */

//     const additional = (tier.additionalCharges || []).reduce(
//       (sum, c) => sum.plus(c.amount || 0),
//       new Decimal(0),
//     );

//     /* ---------------- PLATFORM & ZAPPY (ON BASE) ---------------- */

//     const platform = this.calculateFee(tier.platformFee, base);
//     const zappy = this.calculateFee(tier.zappyCommission, base);

//     /* ---------------- USER SIDE ---------------- */

//     const subtotal = base
//       .plus(platform.user)
//       .plus(zappy.user)
//       .plus(additional);

//     const gstOnSubtotal = subtotal
//       .mul(tier.gst?.userCharge || 0)
//       .div(100);

//     const amountWithGst = subtotal.plus(gstOnSubtotal);

//     /* ---------------- GATEWAY (ON AMOUNT WITH GST) ---------------- */

//     let gateway = this.calculateFee(
//       tier.gatewayFee,
//       amountWithGst,
//     );

//     // If gateway does NOT include GST → add GST separately
//     if (!tier.gatewayFee?.includeGST) {
//       const gatewayGst = gateway.user
//         .mul(tier.gst?.userCharge || 0)
//         .div(100);

//       gateway = {
//         ...gateway,
//         user: gateway.user.plus(gatewayGst),
//       };
//     }

//     const userPayment = amountWithGst.plus(gateway.user);

//     /* ---------------- VENDOR SIDE ---------------- */

//     const vendorTaxBase = base
//       .plus(platform.vendor)
//       .plus(zappy.vendor)
//       .plus(additional);

//     const vendorGst = vendorTaxBase
//       .mul(tier.gst?.vendorCharge || 0)
//       .div(100);

//     const vendorPayout = base
//       .minus(platform.vendor)
//       .minus(zappy.vendor)
//       .minus(gateway.vendor)
//       .minus(vendorGst)
//       .minus(additional);

//     /* ---------------- ADMIN PROFIT ---------------- */

//     const adminProfit = userPayment.minus(vendorPayout);

//     return {
//       userPayment: this.round(userPayment),
//       vendorPayout: this.round(vendorPayout),
//       adminProfit: this.round(adminProfit),
//     };
//   }
// }