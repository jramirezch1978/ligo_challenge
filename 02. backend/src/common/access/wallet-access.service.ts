import { Injectable } from '@nestjs/common';
import { UserRole } from '@app/common/enums/user-role.enum';
import { WalletAccessForbiddenException } from '@app/common/exceptions/business.exceptions';
import { JwtPayload } from '@app/auth/interfaces/jwt-payload.interface';

interface OwnedWallet {
  id: string;
  ownerName?: string | null;
}

/**
 * Enforces wallet-level ownership authorization.
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
