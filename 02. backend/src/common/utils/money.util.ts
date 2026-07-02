import Decimal from 'decimal.js';

/**
 * DESIGN PATTERN — Value Object (DDD) / Immutability.
 *
 * `Money` wraps decimal.js so every monetary calculation is exact, and
 * exposes only intention-revealing operations (`add`, `subtract`,
 * `isLessThan`, ...) instead of raw arithmetic. Two instances with the same
 * amount are interchangeable (compared by `equals()`, not by reference), the
 * private constructor + `of`/`zero` static factories prevent constructing an
 * invalid instance, and every operation RETURNS A NEW `Money` rather than
 * mutating `this` (immutability — avoids an entire class of concurrency and
 * "who mutated my balance" bugs). Money always enters/leaves the domain as a
 * string (never `number`/`float`) to avoid IEEE-754 rounding errors when
 * handling currency amounts. This also solves the "primitive obsession"
 * code smell: business rules read as `amount.isLessThan(balance)` instead of
 * bare string/number comparisons scattered across the codebase.
 */
export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value;
  }

  static of(amount: string | number): Money {
    return new Money(new Decimal(amount));
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isGreaterThan(other: Money): boolean {
    return this.value.greaterThan(other.value);
  }

  isGreaterThanOrEqual(other: Money): boolean {
    return this.value.greaterThanOrEqualTo(other.value);
  }

  isLessThan(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  /** Fixed 2-decimal string representation, as persisted/returned by the API. */
  toString(): string {
    return this.value.toFixed(2);
  }

  toNumber(): number {
    return this.value.toNumber();
  }
}

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

export function isValidMoneyAmount(value: string): boolean {
  if (typeof value !== 'string' || !MONEY_REGEX.test(value)) {
    return false;
  }
  return Money.of(value).isPositive();
}
