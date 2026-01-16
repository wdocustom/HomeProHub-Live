import { CacheAdapter } from './types';
import { config } from './config';
import logger from './logger';

// ===== In-Memory Cache =====

class MemoryCache implements CacheAdapter {
  private cache = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds = 3600): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  // Cleanup expired entries periodically
  startCleanup(intervalMs = 60000) {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expires) {
          this.cache.delete(key);
        }
      }
    }, intervalMs);
  }
}

// ===== Redis Cache Adapter (Stub) =====

class RedisCache implements CacheAdapter {
  private client: any; // ioredis.Redis

  constructor(redisUrl: string) {
    try {
      // Lazy import to avoid errors when Redis is not configured
      const Redis = require('ioredis');
      this.client = new Redis(redisUrl);

      this.client.on('error', (err: Error) => {
        logger.error('Redis error', { error: err.message });
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
      });
    } catch (error) {
      logger.warn('Redis not available, falling back to memory cache', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds = 3600): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, value);
    } catch (error) {
      logger.error('Redis SET failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}

// ===== Cache Factory =====

export function createCache(): CacheAdapter {
  if (config.cache.redisUrl) {
    try {
      return new RedisCache(config.cache.redisUrl);
    } catch (error) {
      logger.warn('Failed to initialize Redis, using memory cache');
    }
  }

  const memCache = new MemoryCache();
  memCache.startCleanup();
  return memCache;
}

export const cache = createCache();
