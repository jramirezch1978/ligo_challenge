import { Money, isValidMoneyAmount } from './money.util';

describe('Money', () => {
  it('adds two amounts precisely, avoiding float rounding errors', () => {
    const result = Money.of('0.10').add(Money.of('0.20'));
    expect(result.toString()).toBe('0.30');
  });

  it('subtracts two amounts precisely', () => {
    const result = Money.of('100.00').subtract(Money.of('33.33'));
    expect(result.toString()).toBe('66.67');
  });

  it('compares amounts correctly', () => {
    expect(Money.of('10.00').isGreaterThan(Money.of('9.99'))).toBe(true);
    expect(Money.of('10.00').isGreaterThanOrEqual(Money.of('10.00'))).toBe(true);
    expect(Money.of('9.99').isLessThan(Money.of('10.00'))).toBe(true);
    expect(Money.of('10.00').equals(Money.of('10.00'))).toBe(true);
  });

  it('detects sign correctly', () => {
    expect(Money.of('0.00').isZero()).toBe(true);
    expect(Money.of('1.00').isPositive()).toBe(true);
    expect(Money.of('-1.00').isNegative()).toBe(true);
  });

  it('always renders a fixed 2-decimal string representation', () => {
    expect(Money.of('5').toString()).toBe('5.00');
    expect(Money.of('5.1').toString()).toBe('5.10');
  });
});

describe('isValidMoneyAmount', () => {
  it.each(['25.50', '100', '0.01', '1500.00'])('accepts valid amount %s', (value) => {
    expect(isValidMoneyAmount(value)).toBe(true);
  });

  it.each(['0', '0.00', '-5.00', '5.999', 'abc', '', '5.5.5', '5,50'])(
    'rejects invalid amount %s',
    (value) => {
      expect(isValidMoneyAmount(value)).toBe(false);
    },
  );
});
