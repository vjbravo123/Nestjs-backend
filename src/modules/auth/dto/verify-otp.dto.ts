import { IsNumber, IsNotEmpty, IsString, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
export class VerifyOtpDto {
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    mobile: number;

    @IsNotEmpty()

    otp: string;

    @IsString()
    @IsNotEmpty()
    @IsIn(['user', 'vendor']) // remove 'admin' if not allowed
    role: 'user' | 'vendor';
}
