// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import WishlistItem from '../_lib/models/WishlistItem.js';
import Deal from '../_lib/models/Deal.js';
import { searchProducts } from '../_lib/search.js';

/**
 * GET /api/cron/price-check
 * Called by external cron every 6 hours.
 *
 * Real implementation: groups tracked wishlist items by product title,
 * re-fetches CURRENT live prices via searchProducts() (the same scraping/
 * caching pipeline used by search), compares against each wishlist item's
 * savedPrice, and upserts a real Deal record whenever the current price has
 * dropped below what at least one user saved it at. Deal.trackersCount
 * reflects how many distinct users are tracking that price drop.
 *
 * Capped to a bounded number of distinct product titles per run to avoid
 * unbounded ScraperAPI credit usage — the cache layer inside searchProducts()
 * means repeated titles across runs are cheap after the first fetch.
 */
const MAX_DISTINCT_TITLES_PER_RUN = 25;

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectDB();

    const items = await WishlistItem.find({}).limit(500).lean();
    let checked = 0;
    let drops = 0;
    const errors: string[] = [];

    // Group wishlist items by normalized product title so we only re-fetch
    // live prices once per distinct product, and can count trackers.
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = normalizeTitle(item.productTitle);
      const group = groups.get(key) || [];
      group.push(item);
      groups.set(key, group);
    }

    const distinctTitles = Array.from(groups.entries()).slice(0, MAX_DISTINCT_TITLES_PER_RUN);

    for (const [, group] of distinctTitles) {
      const representative = group[0];
      checked += group.length;

      let liveResults;
      try {
        liveResults = await searchProducts(representative.productTitle);
      } catch (e: any) {
        errors.push(`${representative.productTitle}: ${e?.message || 'search failed'}`);
        continue;
      }

      if (!liveResults || liveResults.length === 0) continue;

      // For each wishlist item in the group, try to find the live listing on
      // the SAME platform the user saved it from; fall back to the cheapest
      // live listing overall if that platform isn't present in this fetch.
      const cheapestOverall = liveResults[0]; // searchProducts() returns price-sorted results

      // Bucket wishlist items in this group by which live listing applies to
      // them, so multiple droppers on the same listing count toward one
      // Deal's trackersCount instead of creating duplicate Deal rows.
      const dropsByListing = new Map<string, { listing: typeof cheapestOverall; trackerCount: number; maxSavedPrice: number }>();

      for (const item of group) {
        const platformMatch = liveResults.find(
          (r) => r.platform.toLowerCase().includes(item.platform.toLowerCase()) ||
                 item.platform.toLowerCase().includes(r.platform.toLowerCase())
        );
        const listing = platformMatch || cheapestOverall;

        if (listing.price >= item.savedPrice) continue; // no drop for this tracker

        drops++;
        const listingKey = `${listing.platform}::${listing.url}`;
        const existing = dropsByListing.get(listingKey);
        if (existing) {
          existing.trackerCount += 1;
          existing.maxSavedPrice = Math.max(existing.maxSavedPrice, item.savedPrice);
        } else {
          dropsByListing.set(listingKey, { listing, trackerCount: 1, maxSavedPrice: item.savedPrice });
        }
      }

      for (const { listing, trackerCount, maxSavedPrice } of dropsByListing.values()) {
        const dropPercentage = Math.round(((maxSavedPrice - listing.price) / maxSavedPrice) * 100);
        if (dropPercentage <= 0) continue;

        await Deal.findOneAndUpdate(
          { productTitle: representative.productTitle, platform: listing.platform },
          {
            productTitle: representative.productTitle,
            brand: listing.brand,
            imageUrl: listing.imageUrl,
            platform: listing.platform,
            currentPrice: listing.price,
            previousPrice: maxSavedPrice,
            dropPercentage,
            url: listing.url,
            detectedAt: new Date(),
            trackersCount: trackerCount,
            active: true,
          },
          { upsert: true, new: true }
        );
      }
    }

    return res.json({
      checked,
      drops,
      distinctProductsChecked: distinctTitles.length,
      totalDistinctProducts: groups.size,
      errors: errors.length ? errors : undefined,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Price check failed', message: e.message });
  }
}
