import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WithdrawDto } from './dto/withdraw.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';

const WALLET_TTL = 30;
const walletKey = (courierId: string) => `wallet:${courierId}`;

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findByCourier(courierId: string) {
    return this.redis.getOrSet(
      walletKey(courierId),
      async () => {
        const wallet = await this.prisma.wallet.findUnique({
          where: { courierId },
        });
        if (!wallet) throw new NotFoundException('Wallet not found');
        return wallet;
      },
      WALLET_TTL,
    );
  }

  async listTransactions(courierId: string, query: ListTransactionsDto) {
    const wallet = await this.prisma.wallet.findUnique({ where: { courierId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.prisma.transaction.findMany({
      where: { walletId: wallet.id, ...(query.type ? { type: query.type } : {}) },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async withdraw(courierId: string, dto: WithdrawDto) {
    const wallet = await this.prisma.wallet.findUnique({ where: { courierId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (Number(wallet.balance) < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const [, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: dto.amount } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'withdrawal',
          amount: -Math.abs(dto.amount),
        },
      }),
    ]);

    await this.redis.del(walletKey(courierId));

    const updatedWallet = await this.prisma.wallet.findUnique({
      where: { id: wallet.id },
    });

    return {
      transactionId: transaction.id,
      newBalance: updatedWallet?.balance,
      status: 'completed',
    };
  }

  /** Called by OrdersService when a delivery is completed, to credit earnings/tips. */
  async creditEarning(courierId: string, orderId: string, earning: number, tip: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { courierId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: earning },
          tipsBalance: { increment: tip },
        },
      }),
      this.prisma.transaction.create({
        data: { walletId: wallet.id, orderId, type: 'earning', amount: earning },
      }),
      ...(tip > 0
        ? [
            this.prisma.transaction.create({
              data: { walletId: wallet.id, orderId, type: 'tip', amount: tip },
            }),
          ]
        : []),
    ]);

    await this.redis.del(walletKey(courierId));
  }
}
