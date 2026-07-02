import { Injectable } from '@nestjs/common';
import { UserRole } from '@app/common/enums/user-role.enum';
import { WalletAccessForbiddenException } from '@app/common/exceptions/business.exceptions';
import { JwtPayload } from '@app/auth/interfaces/jwt-payload.interface';

interface OwnedWallet {
  id: string;
  ownerName?: string | null;
}

/**
 * DESIGN PATTERN — Strategy (authorization policy) + SOLID.
 *
 * Enforces wallet-level ownership authorization as a single, swappable
 * policy object instead of scattering `if (role === ...)` checks across
 * every controller/service (SRP: the ONLY responsibility of this class is
 * "may this actor operate this wallet?"). Every write/read use case
 * (`WalletsService`, `TransactionsService`) depends on this class through
 * plain constructor injection — Dependency Inversion Principle: high-level
 * business logic depends on a small, stable abstraction, not the other way
 * around. Adding a future role (e.g. `AUDITOR`) only means extending the
 * `UserRole` enum and this policy, with zero changes to its callers (OCP).
 *
 * - ADMIN identities (back-office/service account) can operate any wallet.
 * - CUSTOMER identities can only operate wallets whose `ownerName` matches the
 *   owner they are scoped to. Any mismatch results in HTTP 403 Forbidden.
 */
@Injectable()
export class WalletAccessService {
  assertCanOperate(user: JwtPayload, wallet: OwnedWallet): void {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (!wallet.ownerName || wallet.ownerName !== user.ownerName) {
      throw new WalletAccessForbiddenException(wallet.id);
    }
  }
}
