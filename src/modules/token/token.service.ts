import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Token, TokenDocument } from './token.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TokenService {
    constructor(
        private jwtService: JwtService,
        @InjectModel(Token.name) private tokenModel: Model<TokenDocument>,
    ) { }

    async createToken(data: Partial<Token>): Promise<TokenDocument> {
        return this.tokenModel.create(data);
    }

    async findByJti(jti: string): Promise<TokenDocument | null> {
        return this.tokenModel.findOne({ jti }).exec();
    }

    async revokeToken(jti: string): Promise<void> {
        await this.tokenModel.updateOne({ jti }, { isRevoked: true }).exec();
    }

    async isTokenValid(jti: string, refreshTokenHash: string): Promise<boolean> {
        const token = await this.tokenModel.findOne({ jti, refreshTokenHash, isRevoked: false }).exec();
        if (!token) return false;
        if (token.expiresAt && token.expiresAt < new Date()) return false;
        return true;
    }

    async generateTokens(adminId: string, device: string, ip: string, userAgent: string) {
        const jti = this.generateJti();
        const payload = {
            adminId,
            jti,
            device,
            ip,
        };
        const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '1d' });
        const refreshToken = await this.jwtService.signAsync(payload, { expiresIn: '7d' });
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.createToken({
            adminId,
            jti,
            ip,
            userAgent,
            refreshTokenHash,
            isRevoked: false,
            expiresAt,
        });
        return {
            accessToken: accessToken,
            refresh_token: refreshToken,
        };
    }

    async verifyRefreshToken(refreshToken: string) {
        try {
            return await this.jwtService.verifyAsync(refreshToken);
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async validateRefreshToken(jti: string, refreshToken: string): Promise<boolean> {
        const token = await this.findByJti(jti);
        if (!token || token.isRevoked) return false;
        const isMatch = await bcrypt.compare(refreshToken, token.refreshTokenHash);
        if (!isMatch) return false;
        if (token.expiresAt && token.expiresAt < new Date()) return false;
        return true;
    }

    private generateJti(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}