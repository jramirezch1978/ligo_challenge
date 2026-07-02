import { ApiProperty } from '@nestjs/swagger';
import { WalletStatus } from '@app/common/enums/wallet-status.enum';

export class WalletSummaryDto {
  @ApiProperty({ example: 'wal_001' })
  id: string;

  @ApiProperty({ example: 'Juan Perez', nullable: true })
  ownerName: string | null;

  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ enum: WalletStatus, example: WalletStatus.ACTIVE })
  status: WalletStatus;
}
