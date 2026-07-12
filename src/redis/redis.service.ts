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
 *
 * Connects lazily and never throws on connection failure. If Redis is
 * unreachable, cache reads/writes simply no-op instead of crashing the
 * whole app (important on serverless, where a bad REDIS_URL shouldn't
 * take down the entire function).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private defaultTtl: number;
  private available = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.defaultTtl = Number(
      this.config.get<string>('REDIS_TTL_SECONDS', '60'),
    );
    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: () => null, // don't keep retrying forever on serverless
    });

    this.client.on('error', (err) => {
      this.available = false;
      this.logger.warn(`Redis unavailable, caching disabled: ${err.message}`);
    });
    this.client.on('connect', () => {
      this.available = true;
      this.logger.log('Connected to Redis');
    });

    // Fire-and-forget: don't block app bootstrap on Redis being reachable
    this.client.connect().catch((err) => {
      this.available = false;
      this.logger.warn(
        `Redis connection failed, caching disabled: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.available) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.available) return;
    try {
      const serialized = JSON.stringify(value);
      await this.client.set(
        key,
        serialized,
        'EX',
        ttlSeconds ?? this.defaultTtl,
      );
    } catch {
      // no-op: caching is best-effort
    }
  }

  async del(key: string): Promise<void> {
    if (!this.available) return;
    try {
      await this.client.del(key);
    } catch {
      // no-op
    }
  }

  /** Delete all keys matching a prefix, e.g. `wallet:{courierId}:*` */
  async delByPrefix(prefix: string): Promise<void> {
    if (!this.available) return;
    try {
      const stream = this.client.scanStream({
        match: `${prefix}*`,
        count: 100,
      });
      const pipeline = this.client.pipeline();
      let found = false;

      for await (const keys of stream) {
        if (keys.length) {
          found = true;
          keys.forEach((key: string) => pipeline.del(key));
        }
      }
      if (found) await pipeline.exec();
    } catch {
      // no-op
    }
  }

  /**
   * Cache-aside helper: returns the cached value if present, otherwise
   * invokes `loader`, caches the result, and returns it. Falls back to
   * calling `loader` directly if Redis is unavailable.
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
