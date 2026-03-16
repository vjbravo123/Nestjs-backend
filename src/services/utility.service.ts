// src/services/utility.service.ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UtilityService {
    private readonly saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

    /**
     * ✅ Hash a plain text password
     */
    async hashPassword(plain: string): Promise<string> {
        const salt = await bcrypt.genSalt(this.saltRounds);
        return bcrypt.hash(plain, salt);
    }

    /**
     * ✅ Compare plain vs hashed password
     */
    async comparePassword(plain: string, hashed: string): Promise<boolean> {
        if (!hashed) return false;
        return bcrypt.compare(plain, hashed);
    }

    /**
     * ✅ Check if password needs rehash (if rounds updated)
     */
    async needsRehash(hash: string): Promise<boolean> {
        const rounds = bcrypt.getRounds(hash);
        return rounds !== this.saltRounds;
    }

    /**
     * ✅ Sanitize user/vendor object (remove password & sensitive fields)
     */
    sanitizeEntity<T extends Record<string, any>>(entity: T): Omit<T, 'password' | 'refreshToken'> {
        const { password, refreshToken, ...rest } = entity;
        return rest as Omit<T, 'password' | 'refreshToken'>;
    }

    /**
     * ✅ Utility to generate random OTP (e.g., 6-digit)
     */
    generateOtp(length = 6): string {
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < length; i++) {
            otp += digits[Math.floor(Math.random() * 10)];
        }
        return otp;
    }

    /**
     * ✅ Utility to normalize email (trim + lowercase)
     */
    normalizeEmail(email: string): string {
        return email.trim().toLowerCase();
    }

    /**
     * ✅ Utility to normalize mobile number (basic)
     */
    normalizeMobile(mobile: string | number): string {
        return String(mobile).replace(/\D/g, ''); // strip non-digits
    }
}
