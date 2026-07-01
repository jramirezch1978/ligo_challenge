import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReversalDto {
  @ApiProperty({ example: 'Merchant refund / reversal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;

  @ApiPropertyOptional({ example: 'rev_123456' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalReference?: string;
}
