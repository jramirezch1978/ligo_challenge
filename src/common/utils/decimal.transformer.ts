import { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL `numeric` columns are returned by `pg` as strings by default,
 * but we make it explicit here so the domain never accidentally works with
 * floating point numbers for money.
 */
export class DecimalTransformer implements ValueTransformer {
  to(value?: string): string | undefined {
    return value;
  }

  from(value?: string): string | undefined {
    return value === null || value === undefined ? value : value;
  }
}
