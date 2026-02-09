import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class RegisterTokenDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsEnum(['android', 'ios', 'web'])
    platform: 'android' | 'ios' | 'web';
}
