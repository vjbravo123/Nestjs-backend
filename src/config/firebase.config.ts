import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseConfig {
    private readonly logger = new Logger(FirebaseConfig.name);
    private firebaseApp: admin.app.App;

    constructor(private readonly configService: ConfigService) {
        // Lazy initialization – do not initialize in constructor to avoid app/no-app in workers
    }

    /**
     * Lazy initialization of Firebase app
     */
    private initialize() {
        if (admin.apps.length) {
            this.firebaseApp = admin.app();
            return;
        }

        const projectId = this.configService.get<string>('FCM_PROJECT_ID');
        const clientEmail = this.configService.get<string>('FCM_CLIENT_EMAIL');
        const rawPrivateKey = this.configService.get<string>('FCM_PRIVATE_KEY');

        if (!projectId || !clientEmail || !rawPrivateKey) {
            throw new Error('🔥 Firebase environment variables are missing');
        }

        const privateKey = this.decodePrivateKey(rawPrivateKey);

        this.validatePrivateKey(privateKey);

        this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });

        this.logger.log('✅ Firebase Admin initialized successfully');
    }

    /**
     * Decode Firebase private key
     * Supports Base64 and escaped newline formats
     */
    private decodePrivateKey(rawKey: string): string {
        try {
            // Auto-detect Base64 (no spaces, long string)
            if (/^[A-Za-z0-9+/=]+$/.test(rawKey.replace(/\s/g, ''))) {
                return Buffer.from(rawKey, 'base64').toString('utf8');
            }
            // Replace escaped newlines from .env
            return rawKey.replace(/\\n/g, '\n');
        } catch (err) {
            this.logger.error('🔥 Failed to decode Firebase private key', err);
            throw new Error('Invalid Firebase private key format');
        }
    }

    /**
     * Validate private key format
     */
    private validatePrivateKey(privateKey: string): void {
        const errors: string[] = [];

        if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
            errors.push('Private key does not start with BEGIN PRIVATE KEY');
        }

        if (!privateKey.includes('-----END PRIVATE KEY-----')) {
            errors.push('Private key does not contain END PRIVATE KEY');
        }

        if (!privateKey.includes('\n')) {
            errors.push('Private key does not contain newline characters');
        }

        if (/[“”‘’]/.test(privateKey)) {
            errors.push('Private key contains smart quotes');
        }

        if (errors.length) {
            this.logger.error('🔥 Invalid Firebase private key detected', { reasons: errors });
            throw new Error(`Invalid Firebase private key format:\n- ${errors.join('\n- ')}`);
        }

        this.logger.log('🔐 Firebase private key format validated');
    }

    /**
     * Get Firebase messaging instance
     * Lazy initializes Firebase if not already done
     */
    get messaging(): admin.messaging.Messaging {
        if (!this.firebaseApp) {
            this.initialize();
        }
        return this.firebaseApp.messaging();
    }
}
