export enum MovementType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

/** Filter helper for the movements listing endpoint (allows an "ALL" wildcard). */
export enum MovementTypeFilter {
  ALL = 'ALL',
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}
