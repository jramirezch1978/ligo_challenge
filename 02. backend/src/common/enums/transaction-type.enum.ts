export enum TransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  TRANSFER = 'TRANSFER',
  REVERSAL = 'REVERSAL',
}

/** Type accepted by the "create transaction" endpoint (transfers and reversals have their own endpoints). */
export enum SimpleTransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}
