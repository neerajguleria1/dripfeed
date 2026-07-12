// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchProducts } from '../_lib/search.js';

// Top 20 queries that cover ~80% of DripFeed traffic
const TOP_QUERIES = [
  'kurta women',
  'saree silk',
  'lehenga',
  'salwar suit',
  'kurti cotton',
  'sneakers men',
  'running shoes',
  'casual shoes women',
  'jeans men',
  'jeans women',
  'dress women',
  'tops women',
  'hoodie men',
  'jacket men',
  'handbag women',
  'watch men',
  'sunglasses',
  'ethnic wear women',
  'western dress',
  'palazzo pants',
];

/**
 * GET /api/cron/prewarm-cache
 * Runs every 6 hours via Vercel cron.
 * Pre-fetches top queries and stores results in MongoDB.
 * After this runs, those queries cost 0 ScraperAPI credits until cache expires.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const results: { query: string; count: number; status: string }[] = [];

  for (const query of TOP_QUERIES) {
    try {
      const products = await searchProducts(query);
      results.push({ query, count: products.length, status: 'ok' });
      // 1s delay between queries — avoids hammering ScraperAPI
      await new Promise(r => setTimeout(r, 1000));
    } catch (e: any) {
      results.push({ query, count: 0, status: e.message });
    }
  }

  const succeeded = results.filter(r => r.status === 'ok').length;
  return res.json({
    warmed: succeeded,
    total: TOP_QUERIES.length,
    results,
  });
}
