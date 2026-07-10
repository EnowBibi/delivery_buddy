import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';
import { WithdrawDto } from './dto/withdraw.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get wallet balances and rate trend' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.findByCourier(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List wallet transactions' })
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsDto,
  ) {
    return this.walletService.listTransactions(user.id, query);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw available funds' })
  withdraw(@CurrentUser() user: AuthenticatedUser, @Body() dto: WithdrawDto) {
    return this.walletService.withdraw(user.id, dto);
  }
}
