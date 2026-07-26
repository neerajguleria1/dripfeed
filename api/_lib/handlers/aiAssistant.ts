/**
 * handlers/aiAssistant.ts
 *
 * POST /api/assistant/:canonicalId
 *
 * Assembles AssistantContext from existing application data
 * (price history, recommendations, product offers, wishlist count)
 * then calls generateAssistantResponse().
 *
 * No new data is scraped — all inputs come from the DB / cache layer.
 */

// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  generateAssistantResponse,
  type AssistantContext,
  type AssistantRecommendation,
} from '../aiAssistant.js';
import { getPriceStats } from '../priceHistory.js';

export async function handleAiAssistant(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const canonicalId = subpath.replace(/^\//, '').split('/')[0];
  if (!canonicalId || canonicalId.length < 3) {
    res.status(400).json({ error: 'canonicalId is required' });
    return;
  }

  try {
    // ── 1. Locate product in SearchCache (reuse existing lookup logic) ─────
    const { connectDB } = await import('../db.js');
    const SearchCache   = (await import('../models/SearchCache.js')).default;
    const { groupSearchResults } = await import('../search.js');

    await connectDB();

    let product: any = null;
    let pool:    any[] = [];

    // Fast path: index lookup
    const indexed = await SearchCache.findOne(
      { canonicalIds: canonicalId },
      { query: 1, results: 1 },
    ).lean();

    if (indexed) {
      const canonicals = groupSearchResults(indexed.results as any[]);
      product = canonicals.find((c: any) => c.id === canonicalId) ?? null;
      pool    = canonicals;
    }

    // Fallback: legacy scan
    if (!product) {
      const recent = await SearchCache.find(
        { canonicalIds: { $exists: false } },
        { query: 1, results: 1 },
      ).sort({ fetchedAt: -1 }).limit(200).lean();

      for (const doc of recent) {
        const canonicals = groupSearchResults(doc.results as any[]);
        const match = canonicals.find((c: any) => c.id === canonicalId);
        if (match) { product = match; pool = canonicals; break; }
      }
    }

    if (!product) {
      res.status(404).json({ error: 'Product not found', canonicalId });
      return;
    }

    // ── 2. Build offers list ───────────────────────────────────────────────
    const offers = (product.offers ?? []).map((o: any) => ({
      platform:      String(o.platform   ?? ''),
      price:         Number(o.price      ?? 0),
      originalPrice: o.originalPrice ? Number(o.originalPrice) : undefined,
      discount:      o.discount      ? Number(o.discount)      : undefined,
      rating:        o.rating        ? Number(o.rating)        : undefined,
    }));

    // ── 3. Price history stats (non-fatal if not available) ───────────────
    let priceStats = undefined;
    try {
      const stats = await getPriceStats(canonicalId);
      if (stats) {
        priceStats = {
          lowestPrice:  stats.lowestPrice,
          highestPrice: stats.highestPrice,
          latestPrice:  stats.latestPrice,
          firstSeen:    stats.firstSeen instanceof Date
            ? stats.firstSeen.toISOString()
            : String(stats.firstSeen),
          lastUpdated: stats.lastUpdated instanceof Date
            ? stats.lastUpdated.toISOString()
            : String(stats.lastUpdated),
        };
      }
    } catch { /* non-fatal */ }

    // ── 4. Recommendations (reuse existing engine) ────────────────────────
    const { buildRecommendations } = await import('../recommendations.js');

    const recs      = buildRecommendations(product, pool, 4);
    const toAssistantRec = (r: any): AssistantRecommendation => ({
      title:    String(r.product?.title    ?? ''),
      price:    Number(r.product?.offers?.[0]?.price ?? 0),
      platform: String(r.product?.offers?.[0]?.platform ?? ''),
      reason:   String(r.reason ?? ''),
    });

    // ── 5. Wishlist signal (how many users tracking this product) ─────────
    let wishlistCount: number | undefined;
    try {
      const { WishlistItem } = await import('../models/WishlistItem.js');
      const count = await WishlistItem.countDocuments({
        productTitle: { $regex: product.title.slice(0, 20), $options: 'i' },
      });
      if (count > 0) wishlistCount = count;
    } catch { /* non-fatal */ }

    // ── 6. Assemble context ───────────────────────────────────────────────
    const ctx: AssistantContext = {
      canonicalId,
      title:           String(product.title  ?? ''),
      brand:           product.brand ? String(product.brand) : undefined,
      offers,
      priceStats,
      betterDeals:     recs.betterDeal.slice(0, 3).map(toAssistantRec),
      similarProducts: recs.similar.slice(0, 3).map(toAssistantRec),
      priceDropped:    recs.priceDropped.slice(0, 3).map(toAssistantRec),
      budgetOptions:   recs.budget.slice(0, 3).map(toAssistantRec),
      wishlistCount,
    };

    // ── 7. Generate (cached or AI) ────────────────────────────────────────
    const response = await generateAssistantResponse(ctx);

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    res.json(response);
  } catch (e: any) {
    console.error('[aiAssistant handler] error:', e?.message?.slice(0, 120));
    res.status(500).json({ error: 'Failed to generate assistant response', message: e?.message });
  }
}
