import { LoggerService, Injectable } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class WinstonLoggerService implements LoggerService {
    private logger: winston.Logger;

    constructor() {
        const isProduction = process.env.NODE_ENV === 'production';

        // Production format (no colors, JSON for better parsing)
        const productionFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.json(),
        );

        // Development format (with colors)
        const developmentFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.colorize({ all: true }),
            winston.format.printf(
                (info) => `${info.timestamp} [${info.context || 'Application'}] ${info.level}: ${info.message}`,
            ),
        );

        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
            format: isProduction ? productionFormat : developmentFormat,
            transports: [
                // Always output to console (stdout/stderr)
                new winston.transports.Console({
                    stderrLevels: ['error'],
                }),
            ],
        });
    }

    log(message: any, context?: string) {
        this.logger.info(message, { context });
    }

    error(message: any, trace?: string, context?: string) {
        this.logger.error(message, { trace, context });
    }

    warn(message: any, context?: string) {
        this.logger.warn(message, { context });
    }

    debug(message: any, context?: string) {
        this.logger.debug(message, { context });
    }

    verbose(message: any, context?: string) {
        this.logger.verbose(message, { context });
    }
}
