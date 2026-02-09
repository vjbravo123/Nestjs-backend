import { IsNotEmpty, IsString, IsNumberString, IsPhoneNumber, Length } from 'class-validator';

export class SendOtpDto {
    @IsNotEmpty()
    @IsString()
    phoneNumber: number; // You may use @IsPhoneNumber if country known

    @IsNotEmpty()
    @IsNumberString()
    @Length(4, 6)  // adjust OTP length
    otpCode: string;
}
