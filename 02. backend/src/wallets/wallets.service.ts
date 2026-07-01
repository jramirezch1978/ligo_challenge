import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './entities/wallet.entity';
import { MovementEntity } from '@app/transactions/entities/movement.entity';
import { TransactionEntity } from '@app/transactions/entities/transaction.entity';
import { BalanceResponseDto } from './dto/balance-response.dto';
import { MovementsQueryDto } from './dto/movements-query.dto';
import { MovementsResponseDto } from './dto/movement-response.dto';
import { WalletNotFoundException } from '@app/common/exceptions/business.exceptions';
import { MovementTypeFilter } from '@app/common/enums/movement-type.enum';
import { TransactionStatusFilter } from '@app/common/enums/transaction-status.enum';
import { WalletAccessService } from '@app/common/access/wallet-access.service';
import { JwtPayload } from '@app/auth/interfaces/jwt-payload.interface';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    @InjectRepository(MovementEntity)
    private readonly movementRepository: Repository<MovementEntity>,
    private readonly walletAccessService: WalletAccessService,
  ) {}

  async getBalance(walletId: string, user: JwtPayload): Promise<BalanceResponseDto> {
    const wallet = await this.findWalletOrFail(walletId);
    this.walletAccessService.assertCanOperate(user, wallet);
    return {
      walletId: wallet.id,
      currency: wallet.currency,
      availableBalance: wallet.availableBalance,
      status: wallet.status,
    };
  }

  async getMovements(
    walletId: string,
    query: MovementsQueryDto,
    user: JwtPayload,
  ): Promise<MovementsResponseDto> {
    const wallet = await this.findWalletOrFail(walletId);
    this.walletAccessService.assertCanOperate(user, wallet);

    const qb = this.movementRepository
      .createQueryBuilder('movement')
      .innerJoinAndSelect(
        TransactionEntity,
        'transaction',
        'transaction.id = movement.transactionId',
      )
      .where('movement.walletId = :walletId', { walletId });

    if (query.type !== MovementTypeFilter.ALL) {
      qb.andWhere('movement.type = :type', { type: query.type });
    }

    if (query.status !== TransactionStatusFilter.ALL) {
      qb.andWhere('transaction.status = :status', { status: query.status });
    }

    const total = await qb.getCount();

    const rows = await qb
      .orderBy('movement.createdAt', 'DESC')
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .getRawMany<{
        movement_id: string;
        movement_type: string;
        movement_amount: string;
        movement_createdAt: Date;
        transaction_id: string;
        transaction_status: string;
        transaction_description: string | null;
        transaction_externalReference: string | null;
      }>();

    return {
      walletId,
      total,
      page: query.page,
      pageSize: query.pageSize,
      movements: rows.map((row) => ({
        transactionId: row.transaction_id,
        amount: row.movement_amount,
        type: row.movement_type,
        status: row.transaction_status,
        description: row.transaction_description,
        externalReference: row.transaction_externalReference,
        createdAt: new Date(row.movement_createdAt).toISOString(),
      })),
    };
  }

  private async findWalletOrFail(walletId: string): Promise<WalletEntity> {
    const wallet = await this.walletRepository.findOne({ where: { id: walletId } });
    if (!wallet) {
      throw new WalletNotFoundException(walletId);
    }
    return wallet;
  }
}
