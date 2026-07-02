import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { MovementTypeFilter } from '@app/common/enums/movement-type.enum';
import { TransactionStatusFilter } from '@app/common/enums/transaction-status.enum';

/**
 * Query-string parameters accepted by `GET /wallets/movements`.
 * The wallet identifier travels as a query param (`walletId`), never as a
 * path param, consistently with every other read endpoint in this API.
 */
export class MovementsQueryDto {
  @ApiProperty({ example: 'wal_001', description: 'Identifier of the wallet to list movements for' })
  @IsString()
  @IsNotEmpty()
  walletId: string;

  @ApiPropertyOptional({ enum: MovementTypeFilter, default: MovementTypeFilter.ALL })
  @IsOptional()
  @IsEnum(MovementTypeFilter)
  type: MovementTypeFilter = MovementTypeFilter.ALL;

  @ApiPropertyOptional({ enum: TransactionStatusFilter, default: TransactionStatusFilter.ALL })
  @IsOptional()
  @IsEnum(TransactionStatusFilter)
  status: TransactionStatusFilter = TransactionStatusFilter.ALL;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
