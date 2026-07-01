import Decimal from 'decimal.js';

/**
 * Wrapper around decimal.js to keep every monetary calculation exact.
 * Money always enters/leaves the domain as a string (never `number`/`float`)
 * to avoid IEEE-754 rounding errors when handling currency amounts.
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
