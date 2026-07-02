import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '@app/common/decorators/public.decorator';

/**
 * DESIGN PATTERN — Chain of Responsibility, plus INHERITANCE/POLYMORPHISM.
 * Registered once as the global `APP_GUARD`, this guard is the first link in
 * the guard → interceptor → controller → filter pipeline every request goes
 * through. It extends Passport's `AuthGuard('jwt')` and overrides
 * `canActivate`/`handleRequest` (polymorphic dispatch: Nest always calls
 * `canActivate()` through the base `CanActivate` interface, but THIS
 * subclass's behavior runs), adding the `@Public()` bypass on top of the
 * inherited JWT-validation behavior instead of reimplementing it.
 *
 * Every route requires a valid JWT unless explicitly marked with `@Public()`
 * (login, health checks, Swagger docs).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw err instanceof Error
        ? new UnauthorizedException('Invalid or missing authentication token')
        : new UnauthorizedException();
    }
    return user;
  }
}
