import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty({ example: 'txn_001' })
  transactionId: string;

  @ApiProperty({ example: 'wal_001' })
  walletId: string;

  @ApiPropertyOptional({ example: 'wal_002', nullable: true })
  targetWalletId?: string | null;

  @ApiProperty({ example: 'DEBIT' })
  type: string;

  @ApiProperty({ example: 'COMPLETED' })
  status: string;

  @ApiProperty({ example: '25.50' })
  amount: string;

  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiPropertyOptional({ example: 'Pago QR comercio', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ example: 'qr_789456', nullable: true })
  externalReference?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reversalOfTransactionId?: string | null;

  @ApiProperty({ example: '2026-06-30T15:00:00.000Z' })
  createdAt: string;
}
