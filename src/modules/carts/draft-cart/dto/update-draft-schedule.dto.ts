import { IsNotEmpty, IsDateString, IsString, MinDate } from 'class-validator';
import { Type } from 'class-transformer';


import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function IsTodayOrFuture(validationOptions?: ValidationOptions) {
    return function (object: any, propertyName: string) {
        registerDecorator({
            name: 'IsTodayOrFuture',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(value: any) {
                    const inputDate = new Date(value);
                    const today = new Date();

                    // reset time → compare ONLY date
                    inputDate.setHours(0, 0, 0, 0);
                    today.setHours(0, 0, 0, 0);

                    return inputDate >= today;
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} cannot be in the past`;
                },
            },
        });
    };
}

export class UpdateDraftScheduleDto {

    @IsNotEmpty()
    @IsDateString({}, { message: 'eventDate must be a valid ISO date string' })
    @IsTodayOrFuture({ message: 'eventDate cannot be in the past' })
    eventDate: string;

    @IsNotEmpty()
    @IsString({ message: 'eventTime must be a string' })
    eventTime: string;
}