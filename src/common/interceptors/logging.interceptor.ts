import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SENSITIVE_KEYS = new Set(['password', 'token', 'authorization', 'jwt', 'secret']);

/** Deep-clones and strips sensitive fields before anything gets logged. */
function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '***REDACTED***' : sanitize(val);
    }
    return result;
  }
  return value;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} - ${Date.now() - start}ms`,
          );
        },
        error: (err) => {
          this.logger.warn(
            `${method} ${originalUrl} failed after ${Date.now() - start}ms: ${JSON.stringify(
              sanitize({ message: err?.message }),
            )}`,
          );
        },
      }),
    );
  }
}
