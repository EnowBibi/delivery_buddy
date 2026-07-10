import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PROFILE_TTL = 120;
const profileKey = (id: string) => `courier:${id}:profile`;

@Injectable()
export class CouriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async completeProfile(courierId: string, dto: CompleteProfileDto) {
    const courier = await this.prisma.courier.update({
      where: { id: courierId },
      data: {
        workId: dto.workId,
        name: dto.name,
        teamId: dto.teamId,
        transportationType: dto.transportationType,
        vehicleNumber: dto.vehicleNumber,
      },
    });
    await this.redis.del(profileKey(courierId));
    return courier;
  }

  async findMe(courierId: string) {
    return this.redis.getOrSet(
      profileKey(courierId),
      async () => {
        const courier = await this.prisma.courier.findUnique({
          where: { id: courierId },
        });
        if (!courier) throw new NotFoundException('Courier not found');
        return courier;
      },
      PROFILE_TTL,
    );
  }

  async update(courierId: string, dto: UpdateProfileDto) {
    const courier = await this.prisma.courier.update({
      where: { id: courierId },
      data: dto,
    });
    await this.redis.del(profileKey(courierId));
    return courier;
  }
}
