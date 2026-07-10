import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type SettingsField =
  | 'fuelManagement'
  | 'billingMethod'
  | 'locationPreferences'
  | 'notificationPreferences';

const SETTINGS_TTL = 120;
const settingsKey = (courierId: string) => `courier:${courierId}:settings`;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async getOrCreate(courierId: string) {
    return this.redis.getOrSet(
      settingsKey(courierId),
      async () => {
        const existing = await this.prisma.courierSettings.findUnique({
          where: { courierId },
        });
        if (existing) return existing;
        return this.prisma.courierSettings.create({ data: { courierId } });
      },
      SETTINGS_TTL,
    );
  }

  async getField(courierId: string, field: SettingsField) {
    const settings = await this.getOrCreate(courierId);
    return settings[field];
  }

  async updateField(courierId: string, field: SettingsField, value: unknown) {
    await this.getOrCreate(courierId); // ensure a row exists
    const updated = await this.prisma.courierSettings.update({
      where: { courierId },
      data: { [field]: value },
    });
    await this.redis.del(settingsKey(courierId));
    return updated[field];
  }

  getSupportInfo() {
    // Static support info - long TTL since it changes rarely
    return this.redis.getOrSet(
      'support:info',
      async () => ({
        supportEmail: 'support@deliverybuddy.com',
        supportPhone: '+1-800-555-0100',
      }),
      3600,
    );
  }
}
