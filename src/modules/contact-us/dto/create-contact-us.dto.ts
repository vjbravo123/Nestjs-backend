import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsMobilePhone } from 'class-validator';

export class CreateContactUsDto {

    @IsString()
    @IsNotEmpty()
    fullName: string;


    @IsEmail()
    email: string;


    @IsMobilePhone('en-IN')
    mobile: string;


    @IsString()
    @IsNotEmpty()
    city: string;

    @ApiProperty({ example: 'I want to know more about your services' })
    @IsString()
    @IsNotEmpty()
    message: string;
}
