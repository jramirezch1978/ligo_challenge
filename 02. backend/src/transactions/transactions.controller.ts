import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransferDto } from './dto/transfer.dto';
import { ReversalDto } from './dto/reversal.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { TransactionStatusResponseDto } from './dto/transaction-status-response.dto';
import { IdempotencyKey } from '@app/common/decorators/idempotency-key.decorator';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { JwtPayload } from '@app/auth/interfaces/jwt-payload.interface';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an atomic debit or credit transaction on a wallet' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Client-generated UUID' })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or missing Idempotency-Key' })
  @ApiResponse({ status: 403, description: 'Wallet does not belong to the authenticated customer' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  @ApiResponse({ status: 409, description: 'Idempotency-Key conflict' })
  @ApiResponse({
    status: 422,
    description: 'Business rule violation (inactive wallet, insufficient funds, currency mismatch)',
  })
  async create(
    @Body() dto: CreateTransactionDto,
    @IdempotencyKey() idempotencyKey: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransactionResponseDto> {
    const { statusCode, body } = await this.transactionsService.createTransaction(
      dto,
      idempotencyKey,
      user,
    );
    res.status(statusCode);
    return body;
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'Transfer funds between two wallets (double-entry: debit source, credit target)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Client-generated UUID' })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Source wallet does not belong to the authenticated customer',
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  @ApiResponse({ status: 409, description: 'Idempotency-Key conflict' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async transfer(
    @Body() dto: TransferDto,
    @IdempotencyKey() idempotencyKey: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransactionResponseDto> {
    const { statusCode, body } = await this.transactionsService.transfer(
      dto,
      idempotencyKey,
      user,
    );
    res.status(statusCode);
    return body;
  }

  @Post(':transactionId/reversal')
  @ApiOperation({ summary: 'Reverse a previously completed transaction exactly once' })
  @ApiParam({ name: 'transactionId', example: 'txn_001' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Client-generated UUID' })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Original transaction wallet does not belong to the authenticated customer',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({
    status: 409,
    description: 'Transaction already reversed or Idempotency-Key conflict',
  })
  @ApiResponse({ status: 422, description: 'Transaction is not in a reversible state' })
  async reverse(
    @Param('transactionId') transactionId: string,
    @Body() dto: ReversalDto,
    @IdempotencyKey() idempotencyKey: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransactionResponseDto> {
    const { statusCode, body } = await this.transactionsService.reverse(
      transactionId,
      dto,
      idempotencyKey,
      user,
    );
    res.status(statusCode);
    return body;
  }

  @Get(':transactionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the current status of a transaction' })
  @ApiParam({ name: 'transactionId', example: 'txn_001' })
  @ApiResponse({ status: 200, type: TransactionStatusResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  getStatus(@Param('transactionId') transactionId: string): Promise<TransactionStatusResponseDto> {
    return this.transactionsService.getStatus(transactionId);
  }
}
