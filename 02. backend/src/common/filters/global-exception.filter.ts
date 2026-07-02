import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * DESIGN PATTERN — Chain of Responsibility / Front Controller.
 * Nest routes every uncaught exception from every controller through this
 * single filter (registered once as `APP_FILTER`), which is itself the last
 * link in the guard → interceptor → filter pipeline chain.
 *
 * POLYMORPHISM in `resolveError()` below: the filter never asks "which
 * concrete exception class is this?" (`WalletNotFoundException`,
 * `InsufficientFundsException`, `WalletAccessForbiddenException`, ...). It
 * only asks `exception instanceof HttpException` and calls the polymorphic
 * `getStatus()` / `getResponse()` methods that EVERY subclass inherits. This
 * is the Open/Closed Principle in practice: new business exceptions (see
 * `business.exceptions.ts`) can be added forever without ever touching this
 * file.
 *
 * SRP: this class has exactly one responsibility — translating any thrown
 * error into the API's single, consistent JSON error shape — and NEVER
 * leaks stack traces or internal details to the client. Full error details
 * are only written to the server-side log.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, error, message } = this.resolveError(exception);

    const body: ErrorResponseBody = {
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${statusCode}: ${JSON.stringify(message)}`,
      );
    }

    response.status(statusCode).json(body);
  }

  private resolveError(exception: unknown): {
    statusCode: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { statusCode: status, error: exception.name, message: payload };
      }

      const payloadObj = payload as Record<string, unknown>;
      return {
        statusCode: status,
        error: (payloadObj.error as string) ?? exception.name,
        message: (payloadObj.message as string | string[]) ?? exception.message,
      };
    }

    if (exception instanceof QueryFailedError) {
      // Database constraint violations must never leak SQL/schema details to the client.
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'The request could not be completed due to a data conflict',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later',
    };
  }
}
