import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body payload for `POST /transactions/reversal`.
 * The identifier of the transaction being reversed travels in the BODY
 * (`transactionId`), not the URL path: every state-changing verb in this API
 * (`POST`/`PUT`/`PATCH`/`DELETE`) receives its target through the body.
 */
export class ReversalDto {
  @ApiProperty({ example: 'txn_001', description: 'Identifier of the transaction to reverse' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

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
