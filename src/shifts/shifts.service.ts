import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ListShiftsDto } from './dto/list-shifts.dto';

const CURRENT_SHIFT_TTL = 15; // short TTL - shift stats change frequently while active
const currentShiftKey = (courierId: string) => `shift:${courierId}:current`;

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async start(courierId: string) {
    const existingActive = await this.prisma.shift.findFirst({
      where: { courierId, status: 'active' },
    });
    if (existingActive) {
      throw new BadRequestException('A shift is already active');
    }

    const shift = await this.prisma.shift.create({
      data: { courierId, status: 'active' },
    });
    await this.redis.del(currentShiftKey(courierId));
    return shift;
  }

  async stop(courierId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { courierId, status: 'active' },
    });
    if (!shift) {
      throw new BadRequestException('No active shift to stop');
    }

    const updated = await this.prisma.shift.update({
      where: { id: shift.id },
      data: { status: 'completed', endTime: new Date() },
    });
    await this.redis.del(currentShiftKey(courierId));
    return updated;
  }

  async findCurrent(courierId: string) {
    return this.redis.getOrSet(
      currentShiftKey(courierId),
      async () => {
        const shift = await this.prisma.shift.findFirst({
          where: { courierId, status: 'active' },
        });
        if (!shift) throw new NotFoundException('No active shift');
        return shift;
      },
      CURRENT_SHIFT_TTL,
    );
  }

  async findAll(courierId: string, query: ListShiftsDto) {
    const take = query.last ?? query.limit ?? 20;
    const skip = query.last ? 0 : ((query.page ?? 1) - 1) * (query.limit ?? 20);

    return this.prisma.shift.findMany({
      where: { courierId, status: 'completed' },
      orderBy: { startTime: 'desc' },
      take,
      skip,
    });
  }

  async findOne(courierId: string, id: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id, courierId },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }
}
