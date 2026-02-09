import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
    mongodbUrl: string;
    port: number;
    nodeEnv: string;
    jwtExpiresIn: string;
    msg91AuthKey: string;
}

// Validate required variable
const msg91AuthKey = process.env.MSG91_AUTH_KEY;
if (!msg91AuthKey) {
    throw new Error("MSG91_AUTH_KEY is missing in environment variables");
}

const config: Config = {
    mongodbUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/zappy',
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

    msg91AuthKey: msg91AuthKey // <— FIX
};

export default config;
