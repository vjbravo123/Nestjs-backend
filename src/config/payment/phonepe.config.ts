import { registerAs } from '@nestjs/config';

export default registerAs('phonepe', () => {
    const clientId = process.env.PHONEPE_CLIENT_ID;
    const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
    const clientVersion = process.env.PHONEPE_CLIENT_VERSION;

    if (!clientId || !clientSecret || !clientVersion) {
        throw new Error(
            'PhonePe config missing: PHONEPE_CLIENT_ID / PHONEPE_CLIENT_SECRET / PHONEPE_CLIENT_VERSION',
        );
    }

    return {
        clientId,
        clientSecret,
        clientVersion: Number(clientVersion),

        environment:
            process.env.NODE_ENV === 'production'
                ? 'PRODUCTION'
                : 'SANDBOX',

        webhook: {
            username: process.env.PHONEPE_WEBHOOK_USERNAME,
            password: process.env.PHONEPE_WEBHOOK_PASSWORD,
        },

        isProduction: process.env.NODE_ENV === 'production',
    };
});
