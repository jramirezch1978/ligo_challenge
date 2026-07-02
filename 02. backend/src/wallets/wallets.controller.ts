import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { BalanceQueryDto } from './dto/balance-query.dto';
import { BalanceResponseDto } from './dto/balance-response.dto';
import { MovementsQueryDto } from './dto/movements-query.dto';
import { MovementsResponseDto } from './dto/movement-response.dto';
import { WalletSummaryDto } from './dto/wallet-summary.dto';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { JwtPayload } from '@app/auth/interfaces/jwt-payload.interface';

/**
 * SOLID — Single Responsibility Principle: this controller only translates
 * HTTP concerns (routing, query-param parsing/validation via DTOs, status
 * codes, Swagger docs) into calls on `WalletsService`. It contains ZERO
 * business logic — that lives exclusively in the service layer.
 *
 * REST verb usage: both routes below are read-only lookups, so they use
 * `GET` with the resource identifier passed as a QUERY PARAM (`?walletId=`)
 * rather than a path param, per this API's convention (see `README`).
 */
@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('list')
  @ApiOperation({
    summary: 'List wallets accessible to the authenticated user (all for ADMIN, owned only for CUSTOMER)',
  })
  @ApiResponse({ status: 200, type: WalletSummaryDto, isArray: true })
  listAccessibleWallets(@CurrentUser() user: JwtPayload): Promise<WalletSummaryDto[]> {
    return this.walletsService.listAccessibleWallets(user);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get the available balance for a wallet' })
  @ApiResponse({ status: 200, type: BalanceResponseDto })
  @ApiResponse({ status: 403, description: 'Wallet does not belong to the authenticated customer' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  getBalance(
    @Query() query: BalanceQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BalanceResponseDto> {
    return this.walletsService.getBalance(query.walletId, user);
  }

  @Get('movements')
  @ApiOperation({ summary: 'List paginated movements for a wallet, filterable by type/status' })
  @ApiResponse({ status: 200, type: MovementsResponseDto })
  @ApiResponse({ status: 403, description: 'Wallet does not belong to the authenticated customer' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  getMovements(
    @Query() query: MovementsQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MovementsResponseDto> {
    return this.walletsService.getMovements(query, user);
  }
}
