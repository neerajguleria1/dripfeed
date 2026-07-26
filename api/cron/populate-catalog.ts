// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import Product from '../_lib/models/Product.js';
import { searchProducts } from '../_lib/search.js';
import { buildAffiliateUrl } from '../_lib/affiliate.js';

/**
 * GET /api/cron/populate-catalog
 * Called every 6 hours by Vercel Cron.
 * Scrapes popular search terms and stores results in MongoDB.
 * This pre-populates the database so user searches are instant DB lookups.
 */

const POPULAR_QUERIES = [
  // Ethnic wear
  'kurta set women', 'silk saree', 'lehenga', 'anarkali', 'palazzo set',
  'cotton kurta', 'sharara set', 'salwar suit',
  // Western
  'jeans women', 'crop top', 'dresses women', 'oversized hoodie',
  'denim jacket', 'maxi dress', 'skirt', 'blazer women',
  // Footwear
  'sneakers men', 'heels women', 'sandals women', 'running shoes',
  'white sneakers', 'flats women', 'sports shoes',
  // Accessories
  'earrings', 'handbag', 'watch men', 'sunglasses',
  // Activewear
  'gym wear women', 'yoga pants', 'track pants', 'sports bra',
  // General trending
  'kurta', 'saree', 'sneakers', 'hoodie', 'jeans', 'dress',
];

// Process in batches to avoid timeout (Vercel cron has 60s max on Pro, 10s on free)
const BATCH_SIZE = 5;
const SCRAPE_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  const MAX_DURATION_MS = 9000; // Stay under 10s free tier limit

  console.log('[populate-catalog] starting run at', new Date().toISOString());

  try {
    await connectDB();

    let processed = 0;
    let stored = 0;
    let skipped = 0;

    for (let i = 0; i < POPULAR_QUERIES.length; i += BATCH_SIZE) {
      // Check if we're running out of time
      if (Date.now() - startTime > MAX_DURATION_MS) {
        console.log('[populate-catalog] approaching time limit — stopping early at query index', i);
        break;
      }

      const batch = POPULAR_QUERIES.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (query) => {
          // Check if we already have fresh data for this query (< 6 hours old)
          const existing = await Product.findOne({
            searchQuery: query.toLowerCase(),
            cachedAt: { $gt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
          });

          if (existing) {
            skipped++;
            return { query, status: 'skipped' };
          }

          // Scrape fresh data
          const products = await searchProducts(query);

          if (products.length === 0) {
            return { query, status: 'empty' };
          }

          // Store each product in MongoDB
          for (const p of products.slice(0, 15)) {
            await Product.findOneAndUpdate(
              { title: p.title, 'platforms.platform': p.platform },
              {
                $set: {
                  title: p.title,
                  brand: p.brand || '',
                  imageUrl: p.imageUrl || '',
                  searchQuery: query.toLowerCase(),
                  cachedAt: new Date(),
                },
                $addToSet: {
                  platforms: {
                    platform: p.platform,
                    price: p.price,
                    originalPrice: p.originalPrice,
                    discount: p.discount,
                    url: p.url,
                    affiliateUrl: buildAffiliateUrl(p.platform, p.url),
                  },
                },
              },
              { upsert: true, new: true }
            );
            stored++;
          }

          processed++;
          return { query, status: 'done', count: products.length };
        })
      );

      // Log any failures in this batch
      results.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`[populate-catalog] query "${batch[idx]}" failed:`, r.reason?.message);
        }
      });

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < POPULAR_QUERIES.length) {
        await sleep(SCRAPE_DELAY_MS);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[populate-catalog] completed — processed=${processed} stored=${stored} skipped=${skipped} duration=${duration}ms`);

    return res.json({
      success: true,
      processed,
      stored,
      skipped,
      duration: `${duration}ms`,
      totalQueries: POPULAR_QUERIES.length,
    });
  } catch (e: any) {
    console.error('[populate-catalog] fatal error:', e?.message);
    return res.status(500).json({ error: 'Catalog population failed', message: e.message });
  }
}
