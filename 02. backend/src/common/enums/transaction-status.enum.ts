export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

/** Filter helper for the movements listing endpoint (allows an "ALL" wildcard). */
export enum TransactionStatusFilter {
  ALL = 'ALL',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}
