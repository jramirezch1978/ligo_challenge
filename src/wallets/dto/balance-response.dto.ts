import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty({ example: 'wal_001' })
  walletId: string;

  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ example: '1500.00' })
  availableBalance: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;
}
