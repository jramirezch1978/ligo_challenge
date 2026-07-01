import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as accessible without a valid JWT (e.g. login, health checks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
