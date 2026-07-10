import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const LIST_TTL = 20;
const listKey = (courierId: string, isRead?: boolean) =>
  `notifications:${courierId}:${isRead === undefined ? 'all' : isRead}`;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(courierId: string, isRead?: boolean) {
    return this.redis.getOrSet(
      listKey(courierId, isRead),
      () =>
        this.prisma.notification.findMany({
          where: { courierId, ...(isRead !== undefined ? { isRead } : {}) },
          orderBy: { createdAt: 'desc' },
        }),
      LIST_TTL,
    );
  }

  async markAsRead(courierId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, courierId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    await this.redis.delByPrefix(`notifications:${courierId}:`);
    return updated;
  }
}
