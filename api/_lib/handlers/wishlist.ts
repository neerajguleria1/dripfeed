// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import { WishlistItem } from '../models/WishlistItem.js';
import { getUserFromRequest } from '../auth.js';
import PriceHistory from '../models/PriceHistory.js';
import SearchCache from '../models/SearchCache.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns up to 7 recent price snapshots (oldest-first) for a given canonicalId.
 * Returns [] when no history is found.
 */
async function getPriceHistoryForCanonical(canonicalId: string): Promise<number[]> {
  try {
    const snaps = await PriceHistory.find({ canonicalId })
      .sort({ fetchedAt: 1 })
      .select('price fetchedAt')
      .limit(7)
      .lean();
    return snaps.map((s: any) => s.price);
  } catch {
    return [];
  }
}

/**
 * Given a product title, attempts to find a canonicalId by scanning recent
 * SearchCache entries whose results contain a matching title (case-insensitive).
 * Returns null when no match is found — price history will be empty for that item.
 *
 * This is a best-effort lookup: WishlistItem stores only a productTitle, not
 * a canonicalId. The canonical id is available inside the SearchCache documents
 * in the `canonicalIds` field (if the result was normalised through the matcher).
 */
async function resolveCanonicalId(productTitle: string): Promise<string | null> {
  try {
    const titleLower = productTitle.trim().toLowerCase();

    // Fast path: SearchCache may have a canonicalIds index entry
    // Look for a SearchCache doc where canonicalIds array contains a plausible match
    // by matching the stored results' titles against the wishlist title.
    const recent = await SearchCache
      .find({ 'results.title': { $regex: titleLower.slice(0, 20), $options: 'i' } })
      .select('canonicalIds results')
      .sort({ fetchedAt: -1 })
      .limit(5)
      .lean();

    for (const doc of recent) {
      if (!doc.results) continue;
      const hit = (doc.results as any[]).find(
        (r: any) => r?.title?.toLowerCase().includes(titleLower.slice(0, 15)),
      );
      if (!hit) continue;

      // The canonicalId is the id field on the raw result
      if (hit.id) return hit.id as string;

      // Fallback: pick from canonicalIds array by index position
      const idx = (doc.results as any[]).indexOf(hit);
      if (doc.canonicalIds && doc.canonicalIds[idx]) return doc.canonicalIds[idx];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Enriches each wishlist item with its last 7 real price snapshots.
 * Returns the original item with an added `priceHistory: number[]` field.
 * Falls back to [] when no canonical match or no history is found.
 *
 * Runs title→canonical lookups in parallel, then batches the history queries,
 * so the entire enrichment is 2 sequential DB round-trips regardless of
 * wishlist size.
 */
async function enrichWithPriceHistory(
  items: any[],
): Promise<any[]> {
  if (!items.length) return items;

  // Step 1: resolve canonicalId for each unique title in parallel
  const uniqueTitles = [...new Set(items.map((i) => i.productTitle as string))];
  const titleToCanonical = new Map<string, string | null>();
  await Promise.all(
    uniqueTitles.map(async (title) => {
      titleToCanonical.set(title, await resolveCanonicalId(title));
    }),
  );

  // Step 2: fetch price history for each resolved canonical in parallel
  const canonicalToHistory = new Map<string, number[]>();
  const resolvedCanonicals = [...new Set(
    [...titleToCanonical.values()].filter((v): v is string => v !== null),
  )];
  await Promise.all(
    resolvedCanonicals.map(async (cid) => {
      canonicalToHistory.set(cid, await getPriceHistoryForCanonical(cid));
    }),
  );

  // Step 3: attach history to each item
  return items.map((item) => {
    const cid = titleToCanonical.get(item.productTitle) ?? null;
    const history = cid ? (canonicalToHistory.get(cid) ?? []) : [];
    return { ...item, priceHistory: history };
  });
}

// --- List / Create ---

async function index(req: VercelRequest, res: VercelResponse) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  await connectDB();

  if (req.method === 'GET') {
    const rawItems = await WishlistItem.find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with real price history (best-effort — never throws)
    let items: any[];
    try {
      items = await enrichWithPriceHistory(rawItems);
    } catch {
      items = rawItems.map((i: any) => ({ ...i, priceHistory: [] }));
    }

    return res.json({ items });
  }

  if (req.method === 'POST') {
    const { productTitle, sourceUrl, platform, savedPrice, imageUrl, brand, notifyOnDrop } = req.body || {};
    if (!productTitle || !sourceUrl || !platform || !savedPrice) {
      return res.status(400).json({ error: 'productTitle, sourceUrl, platform, savedPrice required' });
    }

    const existing = await WishlistItem.findOne({ userId: user.userId, sourceUrl });
    if (existing) return res.json({ item: existing, message: 'Already saved' });

    const item = await WishlistItem.create({
      userId: user.userId,
      userEmail: user.email,
      productTitle,
      sourceUrl,
      platform,
      savedPrice,
      imageUrl,
      brand,
      notifyOnDrop: notifyOnDrop ?? false,
    });

    return res.status(201).json({ item });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

// --- Delete by ID ---

async function byId(req: VercelRequest, res: VercelResponse, id: string) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  if (!id) return res.status(400).json({ error: 'ID required' });

  await connectDB();

  if (req.method === 'DELETE') {
    const item = await WishlistItem.findOneAndDelete({ _id: id, userId: user.userId });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { notifyOnDrop } = req.body || {};
    if (typeof notifyOnDrop !== 'boolean') return res.status(400).json({ error: 'notifyOnDrop (boolean) required' });
    const item = await WishlistItem.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { notifyOnDrop },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json({ item });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

export async function handleWishlist(req: VercelRequest, res: VercelResponse, subpath: string) {
  const cleaned = subpath.startsWith('/') ? subpath.slice(1) : subpath;

  if (!cleaned || cleaned === '') {
    return index(req, res);
  }

  return byId(req, res, cleaned);
}
