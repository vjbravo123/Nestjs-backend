import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsMongoId,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

/**
 * DTO representing a single addon item within the cart.
 * Supports hybrid snapshot + population model.
 */
export class CartAddonItemDto {
    @ApiProperty({
        example: '6734a1f56b2c3d001f9a88aa',
        description: 'MongoDB ObjectId of the addon being added or updated.',
    })
    @IsMongoId()
    addOnId: string;

    @ApiProperty({
        example: '6734a1f56b2c3d001f9a99bb',
        description: 'MongoDB ObjectId of the package selected for this addon.',
    })
    @IsMongoId()
    packageId: string;

    @ApiProperty({
        example: 'Decoration Addon - Silver',
        description: 'Optional snapshot of the selected addon package name.',
        required: false,
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({
        example: 1500,
        description: 'Optional snapshot of the addon package price.',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @ApiProperty({
        example: 1500,
        description: 'Calculated subtotal for this addon (optional).',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    subtotal?: number;
}

/**
 * DTO for adding or updating addons within a specific cart item.
 */
export class UpdateCartAddonsDto {
    @ApiProperty({
        example: '6741f1d26b3c4e003d5b21aa',
        description: 'The unique cart item ID for which addons are being updated.',
    })
    @IsMongoId()
    cartItemId: string;

    @ApiProperty({
        type: [CartAddonItemDto],
        description: 'List of addons to add, update, or remove for this cart item.',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CartAddonItemDto)
    addons: CartAddonItemDto[];
}
