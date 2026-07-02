import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

/**
 * DESIGN PATTERN — Template Method + INHERITANCE/POLYMORPHISM.
 *
 * `BusinessRuleException` is an abstract base class that fixes the common
 * shape of every "the request is well-formed but violates a domain rule"
 * error (HTTP 422 Unprocessable Entity). Concrete subclasses only supply the
 * varying part (the message), while the invariant part (status code + error
 * label) lives once in the base class (SOLID: Open/Closed Principle — new
 * business rules are added by EXTENDING this class, never by modifying it or
 * the code that consumes it).
 *
 * `GlobalExceptionFilter` never checks for these concrete subclasses by name:
 * it only asks "is this an `HttpException`?" and calls its polymorphic
 * `getStatus()` / `getResponse()` methods. Every subclass below is therefore
 * used POLYMORPHICALLY through its common ancestor (Liskov Substitution
 * Principle: any subclass can be thrown/caught wherever the base type is
 * expected, without surprises).
 */
export abstract class BusinessRuleException extends HttpException {
  protected constructor(message: string) {
    super({ message, error: 'Unprocessable Entity' }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

// ---- 404 Not Found (resource does not exist) ------------------------------

export class WalletNotFoundException extends NotFoundException {
  constructor(walletId: string) {
    super(`Wallet '${walletId}' was not found`);
  }
}

export class TransactionNotFoundException extends NotFoundException {
  constructor(transactionId: string) {
    super(`Transaction '${transactionId}' was not found`);
  }
}

// ---- 403 Forbidden (authenticated, but not authorized) --------------------

export class WalletAccessForbiddenException extends ForbiddenException {
  constructor(walletId: string) {
    super({
      message: `You do not have permission to operate wallet '${walletId}'`,
      error: 'Forbidden',
    });
  }
}

// ---- 422 Unprocessable Entity (well-formed request, business rule broken) -
// Every exception below reuses `BusinessRuleException`'s constructor instead
// of repeating `HttpStatus.UNPROCESSABLE_ENTITY` and the error label: a direct,
// concrete application of DRY through inheritance.

export class WalletNotActiveException extends BusinessRuleException {
  constructor(walletId: string) {
    super(`Wallet '${walletId}' is not ACTIVE and cannot operate`);
  }
}

export class InsufficientFundsException extends BusinessRuleException {
  constructor(walletId: string) {
    super(`Wallet '${walletId}' has insufficient funds for this operation`);
  }
}

export class CurrencyMismatchException extends BusinessRuleException {
  constructor() {
    super('Operation currency does not match the wallet currency');
  }
}

export class SameWalletTransferException extends BusinessRuleException {
  constructor() {
    super('Source and target wallet must be different');
  }
}

export class TransactionNotReversibleException extends BusinessRuleException {
  constructor(transactionId: string) {
    super(`Transaction '${transactionId}' is not in a reversible state`);
  }
}

// ---- 409 Conflict (the request collides with concurrent/previous state) ---

export class TransactionAlreadyReversedException extends ConflictException {
  constructor(transactionId: string) {
    super(`Transaction '${transactionId}' has already been reversed`);
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

// ---- 400 Bad Request -------------------------------------------------------

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
