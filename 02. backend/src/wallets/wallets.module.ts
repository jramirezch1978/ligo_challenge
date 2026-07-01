import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletEntity } from './entities/wallet.entity';
import { MovementEntity } from '@app/transactions/entities/movement.entity';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { WalletAccessService } from '@app/common/access/wallet-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([WalletEntity, MovementEntity])],
  controllers: [WalletsController],
  providers: [WalletsService, WalletAccessService],
  exports: [WalletsService],
})
export class WalletsModule {}
