import { randomUUID } from 'crypto';

/** Generates human-readable, prefixed identifiers (e.g. `txn_9f1c...`) used across the API contract. */
export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}
