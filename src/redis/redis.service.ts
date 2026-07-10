import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin wrapper around ioredis providing:
 *  - basic get/set/del with JSON (de)serialization
 *  - a `getOrSet` cache-aside helper to avoid redundant calls to the
 *    database or third-party APIs (e.g. routing/ETA lookups)
 *  - prefix-based invalidation for cache busting on writes
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private defaultTtl: number;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.defaultTtl = Number(this.config.get<string>('REDIS_TTL_SECONDS', '60'));
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.client.set(key, serialized, 'EX', ttlSeconds ?? this.defaultTtl);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Delete all keys matching a prefix, e.g. `wallet:{courierId}:*` */
  async delByPrefix(prefix: string): Promise<void> {
    const stream = this.client.scanStream({ match: `${prefix}*`, count: 100 });
    const pipeline = this.client.pipeline();
    let found = false;

    for await (const keys of stream) {
      if (keys.length) {
        found = true;
        keys.forEach((key: string) => pipeline.del(key));
      }
    }
    if (found) await pipeline.exec();
  }

  /**
   * Cache-aside helper: returns the cached value if present, otherwise
   * invokes `loader`, caches the result, and returns it. Use this to wrap
   * expensive DB reads or third-party API calls (e.g. maps/ETA provider).
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await loader();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }
}
