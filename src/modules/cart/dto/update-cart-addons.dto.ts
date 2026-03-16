import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * 🔹 DTO representing a single addon item inside a cart item.
 * - Uses hybrid snapshot approach (stores name/price snapshot for consistency)
 * - Designed for upsert operations (add/update)
 */
export class AddonItemDto {
  @ApiProperty({
    example: '6734a1f56b2c3d001f9a88aa',
    description: 'Unique ID of the Add-on (reference to AddOn collection)',
  })
  @IsMongoId()
  readonly addOnId: string;

  @ApiProperty({
    example: '6734a1f56b2c3d001f9a99bb',
    description: 'Selected package ID within the add-on (ref: Package)',
  })
  @IsMongoId()
  readonly packageId: string;

  @ApiProperty({
    example: 'Decoration Addon - Silver',
    description: 'Snapshot name of the selected addon package (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly name?: string;

  @ApiProperty({
    example: 1500,
    description: 'Snapshot price of the addon package (optional)',
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  readonly price?: number;

  @ApiProperty({
    example: 1500,
    description: 'Subtotal for this addon (auto-calculated if not provided)',
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  readonly subtotal?: number;
}

/**
 * 🔹 DTO for adding or updating addon items in a specific cart item.
 * - Clean, scalable, and future-proof for handling multiple addons.
 */
export class UpdateCartAddonsDto {
  @ApiProperty({
    type: [AddonItemDto],
    description: 'List of addon items to attach/update for this cart item',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonItemDto)
  readonly addons: AddonItemDto[];
}
