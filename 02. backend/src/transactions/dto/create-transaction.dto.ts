import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { SimpleTransactionType } from '@app/common/enums/transaction-type.enum';
import { IsMoneyAmount } from '@app/common/validators/is-money-amount.validator';

export class CreateTransactionDto {
  @ApiProperty({ example: 'wal_001' })
  @IsString()
  @IsNotEmpty()
  walletId: string;

  @ApiProperty({ enum: SimpleTransactionType, example: SimpleTransactionType.DEBIT })
  @IsEnum(SimpleTransactionType)
  type: SimpleTransactionType;

  @ApiProperty({ example: '25.50', description: 'Decimal string amount, never a float' })
  @IsMoneyAmount()
  amount: string;

  @ApiProperty({ example: 'PEN' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiPropertyOptional({ example: 'Pago QR comercio' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: 'qr_789456' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalReference?: string;
}
