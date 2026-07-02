import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Query-string parameters accepted by `GET /transactions/status`. */
export class TransactionStatusQueryDto {
  @ApiProperty({ example: 'txn_001', description: 'Identifier of the transaction to inspect' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;
}
