import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransferDto } from './dto/transfer.dto';
import { ReversalDto } from './dto/reversal.dto';
import { TransactionStatusQueryDto } from './dto/transaction-status-query.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { TransactionStatusResponseDto } from './dto/transaction-status-response.dto';
import { IdempotencyKey } from '@app/common/decorators/idempotency-key.decorator';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { JwtPayload } from '@app/auth/interfaces/jwt-payload.interface';

/**
 * SOLID — Single Responsibility Principle: HTTP-only concerns live here
 * (routing, DTO validation, status codes, Swagger docs); every business rule
 * and the ACID transaction boundary live in `TransactionsService`.
 *
 * REST verb usage in this controller:
 *  - `POST /transactions`           -> creates a debit/credit (new ledger entry).
 *  - `POST /transactions/transfer`  -> creates a transfer (two ledger entries).
 *  - `POST /transactions/reversal`  -> creates a reversal (a NEW ledger entry
 *    that compensates a previous one). Every identifier for these three
 *    writes travels in the request BODY, never in the URL path.
 *  - `GET /transactions/status`     -> read-only lookup; the identifier
 *    travels as a QUERY PARAM (`?transactionId=`), never a path param.
 *
 * Note there is intentionally no `PUT`/`PATCH`/`DELETE` here: financial
 * transactions are an immutable ledger (append-only) for auditability and
 * ACID durability — a transaction is never edited or physically deleted,
 * only compensated with a new REVERSAL transaction. Modeling the "undo" of a
 * transaction as a `POST` (creates a new resource) instead of a `DELETE`
 * (which would imply destroying history) is itself the CORRECT verb usage
 * for a regulated ledger domain.
 */
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

  @Post('reversal')
  @ApiOperation({ summary: 'Reverse a previously completed transaction exactly once' })
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
    @Body() dto: ReversalDto,
    @IdempotencyKey() idempotencyKey: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransactionResponseDto> {
    const { statusCode, body } = await this.transactionsService.reverse(
      dto,
      idempotencyKey,
      user,
    );
    res.status(statusCode);
    return body;
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the current status of a transaction' })
  @ApiResponse({ status: 200, type: TransactionStatusResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  getStatus(@Query() query: TransactionStatusQueryDto): Promise<TransactionStatusResponseDto> {
    return this.transactionsService.getStatus(query);
  }
}
