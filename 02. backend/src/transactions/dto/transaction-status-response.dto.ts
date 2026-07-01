import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionStatusResponseDto {
  @ApiProperty({ example: 'txn_001' })
  transactionId: string;

  @ApiProperty({ example: 'COMPLETED' })
  status: string;

  @ApiPropertyOptional({ example: 'qr_789456', nullable: true })
  externalReference?: string | null;
}
