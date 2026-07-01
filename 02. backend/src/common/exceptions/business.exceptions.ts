import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

export class WalletNotFoundException extends NotFoundException {
  constructor(walletId: string) {
    super(`Wallet '${walletId}' was not found`);
  }
}

export class WalletAccessForbiddenException extends ForbiddenException {
  constructor(walletId: string) {
    super({
      message: `You do not have permission to operate wallet '${walletId}'`,
      error: 'Forbidden',
    });
  }
}

export class TransactionNotFoundException extends NotFoundException {
  constructor(transactionId: string) {
    super(`Transaction '${transactionId}' was not found`);
  }
}

export class WalletNotActiveException extends HttpException {
  constructor(walletId: string) {
    super(
      {
        message: `Wallet '${walletId}' is not ACTIVE and cannot operate`,
        error: 'Unprocessable Entity',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class InsufficientFundsException extends HttpException {
  constructor(walletId: string) {
    super(
      {
        message: `Wallet '${walletId}' has insufficient funds for this operation`,
        error: 'Unprocessable Entity',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class CurrencyMismatchException extends HttpException {
  constructor() {
    super(
      {
        message: 'Operation currency does not match the wallet currency',
        error: 'Unprocessable Entity',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class SameWalletTransferException extends HttpException {
  constructor() {
    super(
      { message: 'Source and target wallet must be different', error: 'Unprocessable Entity' },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class TransactionNotReversibleException extends HttpException {
  constructor(transactionId: string) {
    super(
      {
        message: `Transaction '${transactionId}' is not in a reversible state`,
        error: 'Unprocessable Entity',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class TransactionAlreadyReversedException extends ConflictException {
  constructor(transactionId: string) {
    super(`Transaction '${transactionId}' has already been reversed`);
  }
}

export class IdempotencyKeyRequiredException extends HttpException {
  constructor() {
    super(
      {
        message: 'The "Idempotency-Key" header is required for this operation',
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class IdempotencyConflictException extends ConflictException {
  constructor() {
    super('The "Idempotency-Key" was already used with a different request payload');
  }
}

export class IdempotencyInProgressException extends ConflictException {
  constructor() {
    super('A request with this "Idempotency-Key" is already being processed');
  }
}
