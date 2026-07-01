import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MovementTypeFilter } from '@app/common/enums/movement-type.enum';
import { TransactionStatusFilter } from '@app/common/enums/transaction-status.enum';

export class MovementsQueryDto {
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
