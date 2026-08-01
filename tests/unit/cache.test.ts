import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  cacheGet,
  cacheSet,
  cacheInvalidate,
  cacheClear,
  cacheSize,
  CACHE_CONFIG,
} from '../../api/_lib/cache';

describe('api/_lib/cache', () => {
  beforeEach(() => {
    cacheClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('CacheEntry with TTL-based expiry', () => {
    it('stores and retrieves values', () => {
      cacheSet('key1', { name: 'test' }, 60_000);
      expect(cacheGet<{ name: string }>('key1')).toEqual({ name: 'test' });
    });

    it('returns null for missing keys', () => {
      expect(cacheGet('nonexistent')).toBeNull();
    });

    it('expires entries after TTL', () => {
      cacheSet('key1', 'value1', 5_000);
      expect(cacheGet('key1')).toBe('value1');

      vi.advanceTimersByTime(5_000);
      expect(cacheGet('key1')).toBeNull();
    });

    it('does not expire entries before TTL', () => {
      cacheSet('key1', 'value1', 5_000);
      vi.advanceTimersByTime(4_999);
      expect(cacheGet('key1')).toBe('value1');
    });
  });

  describe('cacheGet<T>(key)', () => {
    it('returns typed data', () => {
      cacheSet('num', 42, 60_000);
      const result = cacheGet<number>('num');
      expect(result).toBe(42);
    });

    it('promotes accessed entries (LRU behavior)', () => {
      // Fill cache to maxEntries for homeFeed TTL (max 10)
      for (let i = 0; i < 10; i++) {
        cacheSet(`home_${i}`, i, CACHE_CONFIG.homeFeed.ttl);
      }
      // Access the first entry to promote it
      cacheGet('home_0');

      // Insert one more — should evict the least recently used (home_1, not home_0)
      cacheSet('home_new', 99, CACHE_CONFIG.homeFeed.ttl);

      expect(cacheGet('home_0')).toBe(0); // promoted, still present
      expect(cacheGet('home_1')).toBeNull(); // evicted as LRU
      expect(cacheGet('home_new')).toBe(99);
    });
  });

  describe('cacheSet<T>(key, data, ttl)', () => {
    it('overwrites existing entries', () => {
      cacheSet('k', 'old', 60_000);
      cacheSet('k', 'new', 60_000);
      expect(cacheGet('k')).toBe('new');
    });

    it('respects maxEntries for homeFeed TTL (10)', () => {
      for (let i = 0; i < 12; i++) {
        cacheSet(`hf_${i}`, i, CACHE_CONFIG.homeFeed.ttl);
      }
      // First 2 should be evicted
      expect(cacheGet('hf_0')).toBeNull();
      expect(cacheGet('hf_1')).toBeNull();
      // Later entries present
      expect(cacheGet('hf_11')).toBe(11);
      expect(cacheSize()).toBe(10);
    });

    it('respects maxEntries for discoverFeed TTL (50)', () => {
      for (let i = 0; i < 52; i++) {
        cacheSet(`df_${i}`, i, CACHE_CONFIG.discoverFeed.ttl);
      }
      expect(cacheGet('df_0')).toBeNull();
      expect(cacheGet('df_1')).toBeNull();
      expect(cacheGet('df_51')).toBe(51);
      expect(cacheSize()).toBe(50);
    });
  });

  describe('cacheInvalidate(key)', () => {
    it('removes a specific key', () => {
      cacheSet('a', 1, 60_000);
      cacheSet('b', 2, 60_000);
      cacheInvalidate('a');
      expect(cacheGet('a')).toBeNull();
      expect(cacheGet('b')).toBe(2);
    });

    it('is a no-op for missing keys', () => {
      expect(() => cacheInvalidate('nope')).not.toThrow();
    });
  });

  describe('CACHE_CONFIG presets', () => {
    it('homeFeed has 15 minute TTL and 10 max entries', () => {
      expect(CACHE_CONFIG.homeFeed.ttl).toBe(15 * 60 * 1000);
      expect(CACHE_CONFIG.homeFeed.maxEntries).toBe(10);
    });

    it('discoverFeed has 5 minute TTL and 50 max entries', () => {
      expect(CACHE_CONFIG.discoverFeed.ttl).toBe(5 * 60 * 1000);
      expect(CACHE_CONFIG.discoverFeed.maxEntries).toBe(50);
    });
  });

  describe('periodic cleanup', () => {
    it('removes expired entries during cleanup interval', () => {
      cacheSet('short', 'data', 30_000); // 30s TTL
      expect(cacheGet('short')).toBe('data');

      // Advance past TTL (30s) so entry is expired
      vi.advanceTimersByTime(30_000);

      // Entry expired but not yet cleaned up by timer (lazy eviction on get would catch it)
      // Advance to trigger the 60s cleanup interval
      vi.advanceTimersByTime(30_000); // total: 60s — cleanup timer fires

      // The periodic cleanup should have removed the expired entry
      expect(cacheSize()).toBe(0);
    });
  });
});
