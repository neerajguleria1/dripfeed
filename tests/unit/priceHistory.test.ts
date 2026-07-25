/**
 * tests/unit/priceHistory.test.ts
 *
 * Unit tests for the price-history repository layer.
 * All MongoDB calls are mocked — no real DB connection needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (registered before any import of the module under test) ────────────

const mockAggregate  = vi.fn();
const mockInsertMany = vi.fn();
const mockFind       = vi.fn();
const mockFindOne    = vi.fn();
const mockCreate     = vi.fn();

vi.mock('../../api/_lib/models/PriceHistory.js', () => ({
  default: {
    aggregate:  (...a: any[]) => mockAggregate(...a),
    insertMany: (...a: any[]) => mockInsertMany(...a),
    find:       (...a: any[]) => mockFind(...a),
    findOne:    (...a: any[]) => mockFindOne(...a),
    create:     (...a: any[]) => mockCreate(...a),
  },
}));

vi.mock('../../api/_lib/db.js', () => ({ connectDB: vi.fn() }));

import {
  saveBulkSnapshots,
  getPriceHistory,
  getPriceStats,
} from '../../api/_lib/priceHistory.js';

// ─── Fixture ──────────────────────────────────────────────────────────────────

function input(overrides: Record<string, unknown> = {}) {
  return {
    canonicalId:   'canon_abc',
    platform:      'Amazon India',
    productId:     'az_B08XYZ',
    price:         1999,
    originalPrice: 2499,
    discount:      20,
    fetchedAt:     new Date('2024-06-01T10:00:00Z'),
    ...overrides,
  };
}

// ─── saveBulkSnapshots ────────────────────────────────────────────────────────

describe('saveBulkSnapshots', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing for empty input', async () => {
    await saveBulkSnapshots([]);
    expect(mockAggregate).not.toHaveBeenCalled();
    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it('inserts all when no recent entries exist (cache miss scenario)', async () => {
    mockAggregate.mockResolvedValue([]);
    mockInsertMany.mockResolvedValue([]);

    await saveBulkSnapshots([
      input({ productId: 'az_A', price: 999 }),
      input({ productId: 'fk_B', platform: 'Flipkart', price: 1099 }),
    ]);

    expect(mockInsertMany).toHaveBeenCalledOnce();
    expect(mockInsertMany.mock.calls[0][0]).toHaveLength(2);
  });

  // ── Live scrape creates history ───────────────────────────────────────────
  it('inserts a snapshot after a live scrape (new product)', async () => {
    mockAggregate.mockResolvedValue([]); // no prior history
    mockInsertMany.mockResolvedValue([]);

    await saveBulkSnapshots([input()]);

    const docs = mockInsertMany.mock.calls[0][0];
    expect(docs).toHaveLength(1);
    expect(docs[0].price).toBe(1999);
    expect(docs[0].platform).toBe('amazon india'); // lowercased
  });

  // ── Cache hit does NOT create history ─────────────────────────────────────
  // (saveBulkSnapshots is never called on cache hits — this test verifies
  //  the dedup guard as a second line of defence)
  it('skips insert when same price exists within 24h dedup window', async () => {
    mockAggregate.mockResolvedValue([
      { _id: { productId: 'az_B08XYZ', platform: 'amazon india' }, latestPrice: 1999 },
    ]);

    await saveBulkSnapshots([input({ price: 1999 })]);

    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  // ── Price change always creates a new snapshot ────────────────────────────
  it('inserts when price has changed within the dedup window', async () => {
    mockAggregate.mockResolvedValue([
      { _id: { productId: 'az_B08XYZ', platform: 'amazon india' }, latestPrice: 2200 },
    ]);
    mockInsertMany.mockResolvedValue([]);

    await saveBulkSnapshots([input({ price: 1999 })]);

    const docs = mockInsertMany.mock.calls[0][0];
    expect(docs).toHaveLength(1);
    expect(docs[0].price).toBe(1999);
  });

  it('inserts only changed products in a mixed batch', async () => {
    // az_A unchanged, fk_B price dropped
    mockAggregate.mockResolvedValue([
      { _id: { productId: 'az_A', platform: 'amazon india' }, latestPrice: 999 },
      { _id: { productId: 'fk_B', platform: 'flipkart' },     latestPrice: 1500 },
    ]);
    mockInsertMany.mockResolvedValue([]);

    await saveBulkSnapshots([
      input({ productId: 'az_A', price: 999 }),           // same  → skip
      input({ productId: 'fk_B', platform: 'Flipkart', price: 1099 }), // changed → insert
    ]);

    const docs = mockInsertMany.mock.calls[0][0];
    expect(docs).toHaveLength(1);
    expect(docs[0].productId).toBe('fk_B');
  });

  it('skips insertMany entirely when all inputs are duplicates', async () => {
    mockAggregate.mockResolvedValue([
      { _id: { productId: 'az_B08XYZ', platform: 'amazon india' }, latestPrice: 1999 },
    ]);

    await saveBulkSnapshots([input()]);

    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it('does NOT store currency field (always INR — omitted to save bytes)', async () => {
    mockAggregate.mockResolvedValue([]);
    mockInsertMany.mockResolvedValue([]);

    await saveBulkSnapshots([input()]);

    const doc = mockInsertMany.mock.calls[0][0][0];
    expect(doc).not.toHaveProperty('currency');
  });

  it('does NOT store availability field', async () => {
    mockAggregate.mockResolvedValue([]);
    mockInsertMany.mockResolvedValue([]);

    await saveBulkSnapshots([input()]);

    const doc = mockInsertMany.mock.calls[0][0][0];
    expect(doc).not.toHaveProperty('availability');
  });

  it('is non-fatal — DB errors never throw to caller', async () => {
    mockAggregate.mockRejectedValue(new Error('Atlas M0 connection limit'));
    await expect(saveBulkSnapshots([input()])).resolves.toBeUndefined();
  });
});

// ─── getPriceHistory ──────────────────────────────────────────────────────────

describe('getPriceHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries with correct 30-day window', async () => {
    const mockSort = vi.fn().mockReturnValue({ lean: () => Promise.resolve([]) });
    mockFind.mockReturnValue({ sort: mockSort });

    await getPriceHistory('canon_abc', 30);

    const filter = mockFind.mock.calls[0][0];
    expect(filter.canonicalId).toBe('canon_abc');
    const diffDays = (Date.now() - (filter.fetchedAt.$gte as Date).getTime()) / 86_400_000;
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('queries with correct 90-day window', async () => {
    const mockSort = vi.fn().mockReturnValue({ lean: () => Promise.resolve([]) });
    mockFind.mockReturnValue({ sort: mockSort });

    await getPriceHistory('canon_abc', 90);

    const filter = mockFind.mock.calls[0][0];
    const diffDays = (Date.now() - (filter.fetchedAt.$gte as Date).getTime()) / 86_400_000;
    expect(diffDays).toBeCloseTo(90, 0);
  });

  it('adds platform filter when provided', async () => {
    const mockSort = vi.fn().mockReturnValue({ lean: () => Promise.resolve([]) });
    mockFind.mockReturnValue({ sort: mockSort });

    await getPriceHistory('canon_abc', 30, 'flipkart');

    expect(mockFind.mock.calls[0][0].platform).toBe('flipkart');
  });

  it('returns results in chronological order (fetchedAt ascending)', async () => {
    const points = [
      { price: 999,  fetchedAt: new Date('2024-01-01') },
      { price: 1099, fetchedAt: new Date('2024-02-01') },
    ];
    const mockSort = vi.fn().mockReturnValue({ lean: () => Promise.resolve(points) });
    mockFind.mockReturnValue({ sort: mockSort });

    const result = await getPriceHistory('canon_abc', 90);

    expect(mockSort).toHaveBeenCalledWith({ fetchedAt: 1 });
    expect(result).toEqual(points);
  });

  it('returns empty array when no history exists', async () => {
    const mockSort = vi.fn().mockReturnValue({ lean: () => Promise.resolve([]) });
    mockFind.mockReturnValue({ sort: mockSort });

    const result = await getPriceHistory('canon_abc', 30);
    expect(result).toEqual([]);
  });
});

// ─── getPriceStats ────────────────────────────────────────────────────────────

describe('getPriceStats', () => {
  beforeEach(() => vi.clearAllMocks());

  const statsResult = {
    lowestPrice:  799,
    highestPrice: 2999,
    latestPrice:  1499,
    firstSeen:    new Date('2024-01-01'),
    lastUpdated:  new Date('2024-06-01'),
  };

  it('returns all five stat fields', async () => {
    mockAggregate.mockResolvedValue([statsResult]);

    const result = await getPriceStats('canon_abc');

    expect(result).toEqual(statsResult);
  });

  it('returns null when no history exists', async () => {
    mockAggregate.mockResolvedValue([]);

    const result = await getPriceStats('canon_abc');
    expect(result).toBeNull();
  });

  it('passes platform filter into the aggregation match stage', async () => {
    mockAggregate.mockResolvedValue([statsResult]);

    await getPriceStats('canon_abc', 'myntra');

    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline[0].$match.platform).toBe('myntra');
  });

  it('does not add platform to match when not provided', async () => {
    mockAggregate.mockResolvedValue([statsResult]);

    await getPriceStats('canon_abc');

    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline[0].$match).not.toHaveProperty('platform');
  });

  // TTL behaviour: after 90 days, MongoDB deletes the docs automatically.
  // The stats query will return null once all docs for a product expire.
  it('returns null after TTL expiry (no documents remain)', async () => {
    mockAggregate.mockResolvedValue([]); // simulates post-TTL state

    const result = await getPriceStats('expired_canon');
    expect(result).toBeNull();
  });
});
