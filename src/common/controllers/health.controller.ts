import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Health Check Controller
 *
 * Provides endpoints for monitoring service health and readiness.
 * Used by Render for health checks and monitoring.
 */
@Controller()
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  /**
   * Basic health check endpoint
   * Returns 200 OK if service is running
   */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Readiness check endpoint
   * Returns 200 OK if service is ready to accept requests
   * Checks MongoDB connection status
   */
  @Get('readiness')
  async getReadiness() {
    const mongoState = this.mongoConnection.readyState;
    const isMongoReady = mongoState === 1; // 1 = connected

    if (!isMongoReady) {
      return {
        status: 'not ready',
        mongodb: this.getMongoStatus(mongoState),
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ready',
      mongodb: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Liveness check endpoint (same as health)
   * Returns 200 OK if service is alive
   */
  @Get('liveness')
  getLiveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Database migrations status endpoint
   * Shows which migrations have been applied to the database
   * Useful for verifying migrations ran during deployment
   */
  @Get('migrations')
  async getMigrations() {
    try {
      if (!this.mongoConnection.db) {
        throw new Error('Database connection not available');
      }

      const migrationsCollection =
        this.mongoConnection.db.collection('changelog');
      const migrations = await migrationsCollection
        .find({})
        .sort({ appliedAt: 1 })
        .toArray();

      return {
        status: 'ok',
        database: this.mongoConnection.db.databaseName,
        totalMigrations: migrations.length,
        migrations: migrations.map((m) => ({
          fileName: m.fileName,
          appliedAt: m.appliedAt,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: this.mongoConnection.db?.databaseName || 'unknown',
        error: 'Failed to fetch migrations',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get MongoDB connection status as string
   */
  private getMongoStatus(state: number): string {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[state] || 'unknown';
  }
}
