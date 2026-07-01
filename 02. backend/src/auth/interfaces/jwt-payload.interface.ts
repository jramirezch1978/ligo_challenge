import { UserRole } from '@app/common/enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  /** Wallet owner this identity is scoped to. Null/undefined for ADMIN (unrestricted). */
  ownerName: string | null;
}
