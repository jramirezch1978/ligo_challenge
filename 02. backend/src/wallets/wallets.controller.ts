import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { BalanceResponseDto } from './dto/balance-response.dto';
import { MovementsQueryDto } from './dto/movements-query.dto';
import { MovementsResponseDto } from './dto/movement-response.dto';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { JwtPayload } from '@app/auth/interfaces/jwt-payload.interface';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get(':walletId/balance')
  @ApiOperation({ summary: 'Get the available balance for a wallet' })
  @ApiParam({ name: 'walletId', example: 'wal_001' })
  @ApiResponse({ status: 200, type: BalanceResponseDto })
  @ApiResponse({ status: 403, description: 'Wallet does not belong to the authenticated customer' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  getBalance(
    @Param('walletId') walletId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BalanceResponseDto> {
    return this.walletsService.getBalance(walletId, user);
  }

  @Get(':walletId/movements')
  @ApiOperation({ summary: 'List paginated movements for a wallet, filterable by type/status' })
  @ApiParam({ name: 'walletId', example: 'wal_001' })
  @ApiResponse({ status: 200, type: MovementsResponseDto })
  @ApiResponse({ status: 403, description: 'Wallet does not belong to the authenticated customer' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  getMovements(
    @Param('walletId') walletId: string,
    @Query() query: MovementsQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MovementsResponseDto> {
    return this.walletsService.getMovements(walletId, query, user);
  }
}
