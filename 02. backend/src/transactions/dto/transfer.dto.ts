import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsMoneyAmount } from '@app/common/validators/is-money-amount.validator';

export class TransferDto {
  @ApiProperty({ example: 'wal_001' })
  @IsString()
  @IsNotEmpty()
  sourceWalletId: string;

  @ApiProperty({ example: 'wal_002' })
  @IsString()
  @IsNotEmpty()
  targetWalletId: string;

  @ApiProperty({ example: '100.00' })
  @IsMoneyAmount()
  amount: string;

  @ApiProperty({ example: 'PEN' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiPropertyOptional({ example: 'Transferencia entre usuarios' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: 'transfer_123' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalReference?: string;
}
