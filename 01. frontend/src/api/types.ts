export interface LoginResponse {
  token: string;
  expiresIn: number;
}

export type WalletStatus = 'ACTIVE' | 'BLOCKED' | 'CLOSED';

export interface BalanceResponse {
  walletId: string;
  currency: string;
  availableBalance: string;
  status: WalletStatus;
}

export type MovementTypeFilter = 'ALL' | 'DEBIT' | 'CREDIT';
export type TransactionStatusFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface MovementItem {
  transactionId: string;
  amount: string;
  type: string;
  status: string;
  description?: string | null;
  externalReference?: string | null;
  createdAt: string;
}

export interface MovementsResponse {
  walletId: string;
  total: number;
  page: number;
  pageSize: number;
  movements: MovementItem[];
}

export interface TransactionResponse {
  transactionId: string;
  walletId: string;
  targetWalletId?: string | null;
  type: string;
  status: string;
  amount: string;
  currency: string;
  description?: string | null;
  externalReference?: string | null;
  reversalOfTransactionId?: string | null;
  createdAt: string;
}

export interface TransactionStatusResponse {
  transactionId: string;
  status: string;
  externalReference?: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
