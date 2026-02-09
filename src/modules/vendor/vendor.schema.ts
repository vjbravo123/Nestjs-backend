import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';
import { SchemaTypes, Types } from 'mongoose';
// Document type for Vendor
export type VendorDocument = Vendor & Document;

@Schema({ timestamps: true })
export class Vendor {
  // Reference to User document
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', })
  userId?: string;

  // Vendor's first name
  @Prop({ required: true, trim: true })
  firstName: string;

  // Vendor's last name
  @Prop({ required: true, trim: true })
  lastName: string;

  // Vendor's email (unique, lowercase)
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  // Vendor's mobile number (unique)
  @Prop({ required: true, unique: true, trim: true })
  mobile: number;

  // Vendor's password (not selected by default)
  @Prop({ required: true, minlength: 6, select: false })
  password: string;

  // Role of the user (always 'vendor')
  @Prop({ enum: ['vendor'], default: 'vendor' })
  role: string;

  // Is vendor active
  @Prop({ default: true })
  isActive?: boolean;

  // Vendor approval status
  @Prop({ default: 'pending', enum: ['none', 'pending', 'approved', 'rejected'] })
  status?: string;

  // Reason for status change (if any)
  @Prop()
  reason?: string;

  // Is mobile number verified
  @Prop({ default: false })
  isMobileVerify?: boolean;

  // Is email verified
  @Prop({ default: false })
  isEmailVerify?: boolean;

  // Business name of the vendor
  @Prop({ trim: true })
  businessName?: string;

  // Business type (reference to category)
  @Prop()
  businessType?: string;

  // Sub business type (reference to subcategory)
  @Prop()
  subBusinessType?: string;

  // Years of experience
  @Prop()
  experience?: string;

  // City of business
  @Prop()
  city?: string;

  // State of business
  @Prop()
  state?: string;

  // Zip code of business
  @Prop()
  zip?: string;

  // Business address
  @Prop()
  businessAddress?: string;

  // Description of business
  @Prop()
  businessDescription?: string;

  // GSTIN number
  @Prop({ trim: true })
  gstin?: string;

  // Array of display image URLs
  @Prop({ type: [String], default: [] })
  displayImages?: string[];

  // Website URL
  @Prop()
  websiteUrl?: string;

  // Social media links (array of platform/url objects)
  @Prop({
    type: [
      {
        platform: { type: String, enum: ['instagram', 'facebook', 'linkedin', 'youtube'] },
        url: { type: String },
      },
    ],
    default: [],
    _id: false,
  })
  socialMediaLinks?: Array<{
    platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube';
    url: string;
  }>;

  // List of services offered
  @Prop({
    type: [SchemaTypes.ObjectId],
    ref: 'Category',
  })
  servicesOffered?: Types.ObjectId[];

  // Has vendor agreed to terms
  @Prop({ default: false })
  agreeToTerms?: boolean;

  // Has vendor given consent
  @Prop({ default: false })
  consent?: boolean;

  // Registration status (draft, in_progress, complete)
  @Prop({ enum: ['draft', 'in_progress', 'complete'], default: 'draft' })
  registrationStatus?: string;

  // Token version for JWT invalidation
  @Prop({ default: 0 })
  tokenVersion: number;

  // Pending changes for profile update approval system
  @Prop({
    type: Object,
    default: null,
    _id: false,
  })
  pendingChanges?: {
    businessName?: string;
    businessType?: string;
    subBusinessType?: string;
    experience?: string;
    city?: string;
    state?: string;
    zip?: string;
    businessAddress?: string;
    businessDescription?: string;
    gstin?: string;
    displayImages?: string[];
    websiteUrl?: string;
    socialMediaLinks?: Array<{
      platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube';
      url: string;
    }>;
    servicesOffered?: string[];
    updatedAt?: Date;
    updatedBy?: string;
  };

  // Is vendor profile verified at first time by admin
  @Prop({ default: false })
  isVerified?: boolean;

  // Status of profile update approval
  @Prop({
    enum: ['none', 'pending', 'approved', 'rejected', 'completed'],
    default: 'none',
  })
  profileUpdateStatus?: string;

  // Reason for profile update status
  @Prop()
  profileUpdateReason?: string;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);

// Index for mobile number
VendorSchema.index({ mobile: 1 }, { unique: true });

// Attach global transform and pagination plugins
VendorSchema.plugin(mongooseGlobalTransformPlugin);
VendorSchema.plugin(paginate);
