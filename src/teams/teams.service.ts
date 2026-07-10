import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const TEAMS_CACHE_KEY = 'teams:all';
const TEAMS_CACHE_TTL = 300; // teams change rarely - cache 5 minutes

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  findAll() {
    return this.redis.getOrSet(
      TEAMS_CACHE_KEY,
      () => this.prisma.team.findMany({ orderBy: { name: 'asc' } }),
      TEAMS_CACHE_TTL,
    );
  }

  async invalidateCache() {
    await this.redis.del(TEAMS_CACHE_KEY);
  }
}
