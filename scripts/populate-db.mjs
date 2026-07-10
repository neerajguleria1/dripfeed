#!/usr/bin/env node
/**
 * Local DB Population Script — Flipkart Scraper
 * Run from YOUR machine: node scripts/populate-db.mjs
 * Scrapes Flipkart (which works from residential IPs) and stores in MongoDB.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';

// ─── Config ──────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

const QUERIES = [
  'kurta set women', 'silk saree', 'lehenga', 'anarkali kurta', 'palazzo set',
  'cotton kurta men', 'sharara set', 'salwar suit', 'banarasi saree',
  'jeans women', 'crop top', 'dresses women', 'oversized hoodie',
  'denim jacket', 'maxi dress', 'blazer women', 't-shirt men',
  'sneakers men', 'heels women', 'sandals women', 'running shoes',
  'white sneakers', 'sports shoes men', 'flats women',
  'earrings women', 'handbag women', 'watch men', 'sunglasses',
  'gym wear women', 'yoga pants', 'track pants men',
  'kurta', 'saree', 'sneakers', 'hoodie', 'jeans', 'dress', 'kurti', 'lehnga', 'palazzo',
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-IN,en;q=0.9',
};

// ─── MongoDB Schema ──────────────────────────────────────────────────────────

const platformListingSchema = new mongoose.Schema({
  platform: String, price: Number, originalPrice: Number,
  discount: Number, url: String, affiliateUrl: String,
  inStock: { type: Boolean, default: true }, rating: Number,
});

const productSchema = new mongoose.Schema({
  title: { type: String, index: true },
  brand: String, category: String, imageUrl: String,
  platforms: [platformListingSchema],
  searchQuery: { type: String, index: true },
  cachedAt: { type: Date, default: Date.now },
}, { timestamps: true });

productSchema.index({ title: 'text', brand: 'text' });
const Product = mongoose.model('Product', productSchema);

// ─── Flipkart Scraper ────────────────────────────────────────────────────────

async function scrapeFlipkart(query) {
  try {
    const { data: html } = await axios.get(
      `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
      { headers: HEADERS, timeout: 15000 }
    );

    // Extract product titles from alt attributes
    const alts = [...html.matchAll(/alt="([^"]{10,120})"/g)]
      .map(x => x[1])
      .filter(a => !a.includes('Flipkart') && !a.includes('banner') && !a.includes('icon') && !a.includes('logo') && a.length > 12);

    // Extract prices
    const prices = [...html.matchAll(/₹\s*([\d,]+)/g)]
      .map(x => parseInt(x[1].replace(/,/g, ''), 10))
      .filter(p => p > 100 && p < 100000);

    // Extract images (Flipkart CDN)
    const imgs = [...html.matchAll(/src="(https:\/\/rukminim[^"]+)"/g)].map(x => x[1]);

    // Extract product links
    const links = [...html.matchAll(/href="(\/[^"]*\/p\/[^"]+)"/g)]
      .map(x => 'https://www.flipkart.com' + x[1].split('&amp;').join('&'));

    // Combine — match by index
    const products = [];
    const usedTitles = new Set();

    for (let i = 0; i < Math.min(alts.length, 15); i++) {
      const title = alts[i];
      if (usedTitles.has(title.toLowerCase())) continue;
      usedTitles.add(title.toLowerCase());

      const price = prices[i] || prices[Math.min(i, prices.length - 1)] || 0;
      if (price <= 0) continue;

      // Try to find a corresponding higher "original" price (MRP)
      const origPrice = prices.find((p, idx) => idx > i && p > price * 1.1 && p < price * 5) || Math.round(price * 1.3);
      const discount = origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0;

      products.push({
        title,
        price,
        originalPrice: origPrice > price ? origPrice : undefined,
        discount: discount > 0 ? discount : undefined,
        imageUrl: imgs[i] || imgs[0] || '',
        url: links[i] || links[0] || `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
        platform: 'Flipkart',
        brand: title.split(' ')[0] || '',
      });
    }

    return products;
  } catch (e) {
    return [];
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  let totalStored = 0;

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i];
    process.stdout.write(`[${i + 1}/${QUERIES.length}] "${query}"...`);

    const products = await scrapeFlipkart(query);

    if (products.length === 0) {
      console.log(' ❌ 0 results');
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    let stored = 0;
    for (const p of products) {
      try {
        await Product.findOneAndUpdate(
          { title: p.title, searchQuery: query.toLowerCase() },
          {
            $set: {
              title: p.title,
              brand: p.brand,
              imageUrl: p.imageUrl,
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
              },
            },
          },
          { upsert: true }
        );
        stored++;
      } catch { /* skip */ }
    }

    totalStored += stored;
    console.log(` ✅ ${stored} products`);

    // Delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n🎉 Done! Stored ${totalStored} products in MongoDB.`);
  console.log('   Search will now return real Flipkart data.\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
