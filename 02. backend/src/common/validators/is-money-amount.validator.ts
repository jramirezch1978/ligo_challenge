import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidMoneyAmount } from '@app/common/utils/money.util';

/** Validates that a string is a strictly-positive decimal amount with at most 2 decimal places. */
export function IsMoneyAmount(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMoneyAmount',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a positive decimal string with up to 2 decimal places (e.g. "25.50")`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidMoneyAmount(value);
        },
      },
    });
  };
}
