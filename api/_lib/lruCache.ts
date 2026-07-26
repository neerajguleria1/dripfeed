/**
 * lruCache.ts
 *
 * Minimal LRU (Least Recently Used) cache backed by a plain JS Map.
 *
 * Design decisions:
 *   - JS Map preserves insertion order and O(1) get/set/delete. LRU is
 *     implemented by deleting and re-inserting on every access (moves the
 *     entry to the "most recently used" tail). On eviction, the first key
 *     (Map iterator head = least recently used) is deleted.
 *   - No WeakMap, no linked list, no external library. The Map approach is
 *     idiomatic for small-to-medium caches (< 10k entries) in Node.js.
 *   - Generic so it replaces both the search memCache and the analytics
 *     aggCache without duplicating logic.
 *   - TTL is optional. When provided, stale entries are evicted on read
 *     (lazy eviction — same pattern as the existing aggCache).
 */

export interface LRUOptions {
  /** Maximum number of entries before the LRU entry is evicted. */
  maxSize: number;
  /** Optional TTL in milliseconds. Stale entries return null on get(). */
  ttlMs?: number;
}

interface Entry<V> {
  value: V;
  cachedAt: number;
}

export class LRUCache<K, V> {
  private readonly map = new Map<K, Entry<V>>();
  private readonly maxSize: number;
  private readonly ttlMs: number | undefined;

  constructor(opts: LRUOptions) {
    this.maxSize = opts.maxSize;
    this.ttlMs   = opts.ttlMs;
  }

  get(key: K): V | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    // TTL check — lazy eviction
    if (this.ttlMs !== undefined && Date.now() - entry.cachedAt > this.ttlMs) {
      this.map.delete(key);
      return null;
    }

    // Move to tail (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Remove existing entry first so re-insertion moves it to tail
    if (this.map.has(key)) this.map.delete(key);

    // Evict LRU entry (Map head) if at capacity
    if (this.map.size >= this.maxSize) {
      const lruKey = this.map.keys().next().value;
      if (lruKey !== undefined) this.map.delete(lruKey);
    }

    this.map.set(key, { value, cachedAt: Date.now() });
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  /** Returns true if the key exists and is not stale. */
  has(key: K): boolean {
    return this.get(key) !== null;
  }
}
