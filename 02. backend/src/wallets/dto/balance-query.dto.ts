import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Query-string parameters accepted by `GET /wallets/balance`.
 *
 * REST convention used across this API: read operations (`GET`) identify
 * the resource exclusively through QUERY PARAMS (never path params), while
 * write operations (`POST`/`PUT`/`PATCH`/`DELETE`) receive every identifier
 * and field through the request BODY.
 */
export class BalanceQueryDto {
  @ApiProperty({ example: 'wal_001', description: 'Identifier of the wallet to inspect' })
  @IsString()
  @IsNotEmpty()
  walletId: string;
}
