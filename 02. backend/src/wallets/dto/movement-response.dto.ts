import { ApiProperty } from '@nestjs/swagger';

export class MovementItemDto {
  @ApiProperty({ example: 'txn_001' })
  transactionId: string;

  @ApiProperty({ example: '25.50' })
  amount: string;

  @ApiProperty({ example: 'DEBIT' })
  type: string;

  @ApiProperty({ example: 'COMPLETED' })
  status: string;

  @ApiProperty({ example: 'Pago QR comercio', required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ example: 'qr_789456', required: false, nullable: true })
  externalReference?: string | null;

  @ApiProperty({ example: '2026-06-30T15:00:00.000Z' })
  createdAt: string;
}

export class MovementsResponseDto {
  @ApiProperty({ example: 'wal_001' })
  walletId: string;

  @ApiProperty({ example: 2 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ type: [MovementItemDto] })
  movements: MovementItemDto[];
}
