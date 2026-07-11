#!/usr/bin/env node
/**
 * Local DB Population Script — Multi-Platform Scraper
 * Scrapes Flipkart + Myntra + Amazon (the 3 that work via HTTP from residential IPs)
 * Run: node scripts/populate-db.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) { console.error('❌ MONGO_URI not set in .env'); process.exit(1); }

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

// ─── MongoDB ─────────────────────────────────────────────────────────────────

const platformListingSchema = new mongoose.Schema({
  platform: String, price: Number, originalPrice: Number,
  discount: Number, url: String, inStock: { type: Boolean, default: true }, rating: Number,
});
const productSchema = new mongoose.Schema({
  title: { type: String, index: true }, brand: String, category: String, imageUrl: String,
  platforms: [platformListingSchema], searchQuery: { type: String, index: true },
  cachedAt: { type: Date, default: Date.now },
}, { timestamps: true });
productSchema.index({ title: 'text', brand: 'text' });
const Product = mongoose.model('Product', productSchema);

// ─── Flipkart ────────────────────────────────────────────────────────────────

async function scrapeFlipkart(query) {
  try {
    const { data: html } = await axios.get(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}`, { headers: HEADERS, timeout: 15000 });
    const alts = [...html.matchAll(/alt="([^"]{12,120})"/g)].map(x => x[1]).filter(a => !a.includes('Flipkart') && !a.includes('banner') && !a.includes('icon') && !a.includes('logo'));
    const prices = [...html.matchAll(/₹\s*([\d,]+)/g)].map(x => parseInt(x[1].replace(/,/g, ''), 10)).filter(p => p > 100 && p < 100000);
    const imgs = [...html.matchAll(/src="(https:\/\/rukminim[^"]+)"/g)].map(x => x[1]);
    const links = [...html.matchAll(/href="(\/[^"]*\/p\/[^"]+)"/g)].map(x => 'https://www.flipkart.com' + x[1].split('&amp;').join('&'));

    const products = [];
    const seen = new Set();
    for (let i = 0; i < Math.min(alts.length, 12); i++) {
      if (seen.has(alts[i].toLowerCase()) || prices[i] <= 0) continue;
      seen.add(alts[i].toLowerCase());
      products.push({ title: alts[i], price: prices[i] || 0, imageUrl: imgs[i] || '', url: links[i] || '', platform: 'Flipkart', brand: alts[i].split(' ')[0] });
    }
    return products.filter(p => p.price > 0);
  } catch { return []; }
}

// ─── Myntra ──────────────────────────────────────────────────────────────────

async function scrapeMyntra(query) {
  try {
    const slug = query.toLowerCase().replace(/\s+/g, '-');
    const { data: html } = await axios.get(`https://www.myntra.com/${slug}`, { headers: HEADERS, timeout: 12000 });

    // Try extracting __INITIAL_STATE__ JSON
    const stateMatch = html.match(/window\.__myx\s*=\s*({[\s\S]*?});\s*<\/script>/i) || html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);

    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const items = state?.searchData?.results?.products || state?.search?.results || state?.products || [];
        return items.slice(0, 10).map((p, i) => ({
          title: `${p.brand || ''} ${p.product || p.name || ''}`.trim(),
          price: p.price || p.discountedPrice || 0,
          originalPrice: p.mrp || p.strikedPrice || undefined,
          discount: p.discount ? parseInt(p.discount) : undefined,
          imageUrl: p.searchImage || p.image || '',
          url: `https://www.myntra.com/${p.landingPageUrl || p.id || i}`,
          platform: 'Myntra',
          brand: p.brand || '',
        })).filter(p => p.price > 0);
      } catch { /* fall through */ }
    }

    // Fallback: regex price extraction
    const prices = [...html.matchAll(/₹\s*([\d,]+)/g)].map(x => parseInt(x[1].replace(/,/g, ''), 10)).filter(p => p > 100 && p < 100000);
    if (prices.length > 0) {
      return prices.slice(0, 8).map((price, i) => ({
        title: `${query} - Style ${i + 1}`,
        price,
        imageUrl: '',
        url: `https://www.myntra.com/${slug}`,
        platform: 'Myntra',
        brand: '',
      }));
    }
    return [];
  } catch { return []; }
}

// ─── Amazon ──────────────────────────────────────────────────────────────────

async function scrapeAmazon(query) {
  try {
    const { data: html } = await axios.get(`https://www.amazon.in/s?k=${encodeURIComponent(query)}`, { headers: HEADERS, timeout: 15000 });

    // Extract product blocks via data-component-type="s-search-result"
    const titles = [...html.matchAll(/class="a-size-base-plus[^"]*"[^>]*>([^<]{10,120})</g)].map(x => x[1].trim());
    const prices = [...html.matchAll(/class="a-price-whole"[^>]*>([\d,]+)/g)].map(x => parseInt(x[1].replace(/,/g, ''), 10)).filter(p => p > 100 && p < 100000);
    const imgs = [...html.matchAll(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/g)].map(x => x[1]);
    const links = [...html.matchAll(/href="(\/[^"]*\/dp\/[A-Z0-9]{10}[^"]*)"/g)].map(x => 'https://www.amazon.in' + x[1]);

    // If title regex didn't work, try alt-based extraction
    let finalTitles = titles;
    if (titles.length < 3) {
      finalTitles = [...html.matchAll(/alt="([^"]{15,150})"/g)]
        .map(x => x[1])
        .filter(a => !a.includes('Amazon') && !a.includes('Sponsored') && !a.includes('logo') && a.length > 15)
        .slice(0, 15);
    }

    const products = [];
    const seen = new Set();
    for (let i = 0; i < Math.min(finalTitles.length, 10); i++) {
      const title = finalTitles[i];
      if (seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());
      const price = prices[i] || prices[0] || 0;
      if (price <= 0) continue;
      products.push({
        title,
        price,
        imageUrl: imgs[i] || '',
        url: links[i] || `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
        platform: 'Amazon India',
        brand: title.split(' ')[0] || '',
      });
    }
    return products;
  } catch { return []; }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');
  console.log('Scraping 3 platforms: Flipkart + Myntra + Amazon\n');

  let totalStored = 0;

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i];
    process.stdout.write(`[${i + 1}/${QUERIES.length}] "${query}" `);

    // Scrape all 3 platforms in parallel
    const [fk, mn, amz] = await Promise.allSettled([
      scrapeFlipkart(query),
      scrapeMyntra(query),
      scrapeAmazon(query),
    ]);

    const allProducts = [
      ...(fk.status === 'fulfilled' ? fk.value : []),
      ...(mn.status === 'fulfilled' ? mn.value : []),
      ...(amz.status === 'fulfilled' ? amz.value : []),
    ];

    if (allProducts.length === 0) {
      console.log('❌ 0');
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    let stored = 0;
    for (const p of allProducts) {
      try {
        await Product.findOneAndUpdate(
          { title: p.title, searchQuery: query.toLowerCase() },
          {
            $set: { title: p.title, brand: p.brand || '', imageUrl: p.imageUrl || '', searchQuery: query.toLowerCase(), cachedAt: new Date() },
            $addToSet: { platforms: { platform: p.platform, price: p.price, originalPrice: p.originalPrice, discount: p.discount, url: p.url } },
          },
          { upsert: true }
        );
        stored++;
      } catch { /* skip */ }
    }

    const counts = `FK:${fk.status === 'fulfilled' ? fk.value.length : 0} MN:${mn.status === 'fulfilled' ? mn.value.length : 0} AMZ:${amz.status === 'fulfilled' ? amz.value.length : 0}`;
    totalStored += stored;
    console.log(`✅ ${stored} (${counts})`);

    await new Promise(r => setTimeout(r, 2500));
  }

  console.log(`\n🎉 Done! Stored ${totalStored} products across 3 platforms.`);
  console.log('   Platforms that block HTTP scraping (Ajio, Meesho, Nykaa, TataCliq) need a headless browser or API.\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
