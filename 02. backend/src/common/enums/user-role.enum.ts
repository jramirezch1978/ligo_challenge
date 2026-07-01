/**
 * Authorization role carried inside the JWT payload.
 * - ADMIN: back-office/service account, can operate any wallet (no ownership check).
 * - CUSTOMER: tied to a single wallet owner; can only operate wallets they own.
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}
