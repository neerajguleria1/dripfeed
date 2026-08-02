/**
 * Cron: Refresh Home Feed
 * 
 * Runs every 24 hours (configured in vercel.json).
 * Scrapes trending products from all platforms for popular categories
 * and stores them in the HomeFeedCache collection.
 * 
 * The /api/feed/home endpoint reads from HomeFeedCache for instant loading.
 * This ensures the homepage ALWAYS shows real, fresh products — never seed data.
 */

// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import { searchProducts } from '../_lib/search.js';
import HomeFeedCache from '../_lib/models/HomeFeedCache.js';

// Categories to pre-scrape for the homepage feed
const CATEGORIES_TO_SCRAPE = [
  { category: 'all', query: 'trending fashion india' },
  { category: 'kurta-sets', query: 'kurta sets women' },
  { category: 'sneakers', query: 'sneakers men' },
  { category: 'sarees', query: 'saree silk' },
  { category: 'jeans', query: 'jeans men women' },
  { category: 'dresses', query: 'dress women party' },
  { category: 'ethnic-wear', query: 'ethnic wear kurta lehenga' },
  { category: 'trending', query: 'trending fashion 2025' },
];

const MAX_PRODUCTS_PER_CATEGORY = 24; // Enough for homepage grid + discovery feed

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET (Vercel Cron triggers with GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (optional but recommended)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow without secret in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('[Cron:refresh-home-feed] Starting homepage feed refresh...');

  try {
    await connectDB();

    const results: { category: string; count: number; error?: string }[] = [];

    // Scrape each category sequentially to avoid burning all ScraperAPI credits at once
    for (const { category, query } of CATEGORIES_TO_SCRAPE) {
      try {
        console.log(`[Cron:refresh-home-feed] Scraping "${query}" for category "${category}"...`);
        
        const canonicals = await searchProducts(query, true /* fastOnly */);
        
        if (!canonicals || canonicals.length === 0) {
          results.push({ category, count: 0, error: 'No results' });
          continue;
        }

        // Map canonical products to HomeFeedCache format
        const products = canonicals.slice(0, MAX_PRODUCTS_PER_CATEGORY).map((c: any) => {
          const cheapest = c.platforms?.[0] || c;
          const originalPrice = cheapest.originalPrice || cheapest.mrp || 0;
          const price = cheapest.price || c.price || 0;
          const discount = originalPrice > price
            ? Math.round((originalPrice - price) / originalPrice * 100)
            : (cheapest.discount || 0);
          const savings = originalPrice - price;

          return {
            id: c.id || c.canonicalId || `cron_${Math.random().toString(36).slice(2, 10)}`,
            title: c.title || cheapest.title || '',
            brand: c.brand || cheapest.brand,
            imageUrl: c.imageUrl || cheapest.imageUrl,
            price,
            originalPrice: originalPrice > price ? originalPrice : undefined,
            discount,
            savings: savings > 200 ? savings : undefined,
            platform: cheapest.platform || 'Unknown',
            url: cheapest.url || c.url,
            category,
          };
        }).filter((p: any) => p.price > 0 && p.title && p.imageUrl);

        // Upsert — one document per category
        await HomeFeedCache.findOneAndUpdate(
          { category },
          {
            category,
            products,
            scrapedAt: new Date(),
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h TTL
          },
          { upsert: true, new: true }
        );

        results.push({ category, count: products.length });
        console.log(`[Cron:refresh-home-feed] ✓ "${category}": ${products.length} products saved`);

        // Small delay between categories to be nice to ScraperAPI rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err: any) {
        console.error(`[Cron:refresh-home-feed] ✗ "${category}" failed:`, err?.message?.slice(0, 100));
        results.push({ category, count: 0, error: err?.message?.slice(0, 80) });
      }
    }

    const totalProducts = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`[Cron:refresh-home-feed] Done. Total: ${totalProducts} products across ${results.length} categories.`);

    return res.status(200).json({
      success: true,
      totalProducts,
      categories: results,
      refreshedAt: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('[Cron:refresh-home-feed] Fatal error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
