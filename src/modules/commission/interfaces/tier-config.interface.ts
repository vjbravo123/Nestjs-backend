export interface FeeConfig {
  type: 'percentage' | 'flat';
  userCharge: number;
  vendorCharge: number;
  includeGST?: boolean;
}

export interface AdditionalCharge {
  label: string;
  amount: number;
}

export interface GstConfig {
  userCharge: number;
  vendorCharge: number;
}

export interface TierConfig {
  tierId: string;
  basePrice: number;
  platformFee: FeeConfig;
  zappyCommission: FeeConfig;
  gatewayFee: FeeConfig;
  gst: GstConfig;
  additionalCharges?: AdditionalCharge[];
}