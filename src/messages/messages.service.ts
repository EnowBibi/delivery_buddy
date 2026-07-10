import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateMessageDto } from './dto/create-message.dto';

const THREAD_TTL = 30;
const threadKey = (orderId: string) => `order:${orderId}:messages`;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(courierId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, courierId },
    });
    if (!order) throw new NotFoundException('Order not found');

    return this.redis.getOrSet(
      threadKey(orderId),
      () =>
        this.prisma.message.findMany({
          where: { orderId },
          orderBy: { createdAt: 'asc' },
        }),
      THREAD_TTL,
    );
  }

  async create(courierId: string, orderId: string, dto: CreateMessageDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, courierId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const message = await this.prisma.message.create({
      data: {
        orderId,
        senderType: 'courier',
        senderId: courierId,
        content: dto.content,
      },
    });

    await this.redis.del(threadKey(orderId));
    return message;
  }
}
