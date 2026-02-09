import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { Types, } from 'mongoose';
import { Transform } from 'class-transformer';
@ValidatorConstraint({ name: 'IsValidObjectId', async: false })
export class IsValidObjectIdConstraint implements ValidatorConstraintInterface {
    validate(value: any) {
        return Types.ObjectId.isValid(value);
    }

    defaultMessage(args: ValidationArguments) {
        return `${args.property} must be a valid MongoDB ObjectId`;
    }
}

/**
 * ✅ Custom decorator you can use in DTOs
 */
export function IsValidObjectId(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsValidObjectIdConstraint,
        });
    };
}

export function TransformToObjectId() {
    return Transform(({ value }) =>
        Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
    );
}
