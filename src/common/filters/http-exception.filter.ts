import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import logger from '../utils/logger';
import { MongoServerError } from 'mongodb';
import mongoose, { Error as MongooseError } from 'mongoose';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let errorBody: any = {};

    // 1️⃣ Handle HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      errorBody = exception.getResponse();

      const extracted =
        typeof errorBody === 'string'
          ? errorBody
          : errorBody.message || exception.message;

      // Convert array → string
      message = Array.isArray(extracted)
        ? extracted.join(', ')
        : extracted;

      // Remove default NestJS "error" field
      if (typeof errorBody === 'object' && 'error' in errorBody) {
        delete errorBody.error;
      }
    }

    // 2️⃣ Mongo duplicate key
    else if ((exception as MongoServerError)?.code === 11000) {
      status = HttpStatus.CONFLICT;
      const duplicatedField = Object.keys(
        (exception as MongoServerError).keyValue || {},
      ).join(', ');

      message = `${duplicatedField} already exists.`;
      errorBody = { errorCode: 'DUPLICATE_KEY', field: duplicatedField };
    }

    // 3️⃣ Mongoose validation errors
    else if (exception instanceof MongooseError.ValidationError) {
      status = HttpStatus.BAD_REQUEST;

      const validationMessages = Object.values(exception.errors).map(
        (err: any) => err.message,
      );

      message = validationMessages.join(', ');
      errorBody = { errorCode: 'VALIDATION_ERROR' };
    }

    // 4️⃣ Generic fallback
    else if ((exception as any)?.message) {
      const extracted = (exception as any).message;
      message = Array.isArray(extracted) ? extracted.join(', ') : extracted;
    } else {
      message = 'Internal server error';
    }

    // Logging
    const stack = exception instanceof Error ? exception.stack : '';

    const logMessage = this.isProduction
      ? `Error:
        Method: ${request.method}
        Path: ${request.url}
        Status: ${status}
        Message: ${message}`
      : `Error:
        Method: ${request.method}
        Path: ${request.url}
        Status: ${status}
        Message: ${message}
        Stack: ${stack}`;

    logger.error(logMessage);

    // Sentry
    Sentry.withScope((scope) => {
      scope.setExtra('request_url', request.url);
      scope.setExtra('request_method', request.method);
      scope.setExtra('error_details', message);
      Sentry.captureException(exception);
    });

    // Build final response
    const errorResponse: any = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof errorBody === 'object' ? errorBody : {}),
    };

    if (!this.isProduction && stack) {
      errorResponse.stack = stack;
    }

    response.status(status).json(errorResponse);
  }
}



// import {
//   ExceptionFilter,
//   Catch,
//   ArgumentsHost,
//   HttpException,
//   HttpStatus,
// } from '@nestjs/common';
// import { Request, Response } from 'express';
// import * as Sentry from '@sentry/node';
// import logger from '../utils/logger';
// import { MongoServerError } from 'mongodb';
// import mongoose, { Error as MongooseError } from 'mongoose';

// @Catch()
// export class HttpExceptionFilter implements ExceptionFilter {
//   private readonly isProduction = process.env.NODE_ENV === 'production';

//   catch(exception: unknown, host: ArgumentsHost) {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse<Response>();
//     const request = ctx.getRequest<Request>();

//     let status = HttpStatus.INTERNAL_SERVER_ERROR;
//     let message: any = 'Internal server error';
//     let errorBody: any = {};

//     // 🌟 Handle HttpException
//     if (exception instanceof HttpException) {
//       status = exception.getStatus();
//       errorBody = exception.getResponse();
//       message =
//         typeof errorBody === 'string'
//           ? errorBody
//           : (errorBody as any).message || exception.message;
//     }
//     // 🔥 Handle duplicate key error
//     else if ((exception as MongoServerError)?.code === 11000) {
//       status = HttpStatus.CONFLICT;
//       const duplicatedField = Object.keys(
//         (exception as MongoServerError).keyValue || {},
//       ).join(', ');
//       message = `${duplicatedField} already exists.`;
//       errorBody = { errorCode: 'DUPLICATE_KEY', field: duplicatedField };
//     }
//     // 🌟 Handle Mongoose validation errors
//     else if (exception instanceof MongooseError.ValidationError) {
//       status = HttpStatus.BAD_REQUEST;
//       message = Object.values(exception.errors).map((err: any) => err.message);
//       errorBody = { errorCode: 'VALIDATION_ERROR' };
//     }
//     // Generic fallback
//     else if ((exception as any)?.message) {
//       message = (exception as any).message;
//     }

//     // Flatten message if nested
//     if (typeof message === 'object' && message !== null) {
//       if ((message as any).message) {
//         message = (message as any).message;
//       }
//     }

//     const stack = exception instanceof Error ? exception.stack : '';

//     // Logging
//     const logMessage = this.isProduction
//       ? `Error:
//         Method: ${request.method}
//         Path: ${request.url}
//         Status: ${status}
//         Message: ${JSON.stringify(message)}`
//       : `Error:
//         Method: ${request.method}
//         Path: ${request.url}
//         Status: ${status}
//         Message: ${JSON.stringify(message)}
//         Stack: ${stack}`;

//     logger.error(logMessage);

//     // Report to Sentry
//     Sentry.withScope((scope) => {
//       scope.setExtra('request_url', request.url);
//       scope.setExtra('request_method', request.method);
//       scope.setExtra('error_details', message);
//       Sentry.captureException(exception);
//     });

//     // 🌟 Final response: preserve custom fields from errorBody
//     const errorResponse: any = {
//       statusCode: status,
//       message,
//       timestamp: new Date().toISOString(),
//       path: request.url,
//       ...(typeof errorBody === 'object' ? errorBody : {}), // merge your custom keys
//     };

//     if (!this.isProduction && stack) {
//       errorResponse.stack = stack;
//     }

//     response.status(status).json(errorResponse);
//   }
// }
