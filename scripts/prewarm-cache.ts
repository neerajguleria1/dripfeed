/**
 * Pre-warm script — run once after deploy or weekly via cron.
 * Seeds the 20 most common fashion searches into MongoDB cache.
 * After this runs, those queries cost 0 ScraperAPI credits for 6 hours.
 *
 * Run: npx tsx scripts/prewarm-cache.ts
 */

import { config } from 'dotenv';
config();

import { searchProducts } from '../api/_lib/search.js';

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

async function prewarm() {
  console.log(`Pre-warming ${TOP_QUERIES.length} queries...\n`);
  let success = 0;
  let failed = 0;

  for (const query of TOP_QUERIES) {
    try {
      const results = await searchProducts(query);
      console.log(`✓ "${query}" — ${results.length} products cached`);
      success++;
      // Small delay to avoid hammering ScraperAPI
      await new Promise(r => setTimeout(r, 1500));
    } catch (e: any) {
      console.log(`✗ "${query}" — ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${success} cached, ${failed} failed.`);
  console.log(`Credits used: ~${success * 11} (est)`);
  process.exit(0);
}

prewarm();
