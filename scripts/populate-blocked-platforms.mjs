#!/usr/bin/env node
/**
 * Puppeteer scraper for blocked platforms: Ajio, Meesho, Nykaa Fashion, Tata CLiQ
 * Run: node scripts/populate-blocked-platforms.mjs
 * Requires: puppeteer (npm install puppeteer --save-dev)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import puppeteer from 'puppeteer';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) { console.error('❌ MONGO_URI not set in .env'); process.exit(1); }

const QUERIES = [
  'kurta set women', 'silk saree', 'lehenga', 'jeans women',
  'sneakers men', 'dress women', 'hoodie', 'kurta',
  'saree', 'palazzo', 'sports shoes', 'earrings',
];

// ─── MongoDB ─────────────────────────────────────────────────────────────────

const platformListingSchema = new mongoose.Schema({
  platform: String, price: Number, originalPrice: Number,
  discount: Number, url: String, inStock: { type: Boolean, default: true },
});
const productSchema = new mongoose.Schema({
  title: { type: String, index: true }, brand: String, imageUrl: String,
  platforms: [platformListingSchema], searchQuery: { type: String, index: true },
  cachedAt: { type: Date, default: Date.now },
}, { timestamps: true });
productSchema.index({ title: 'text', brand: 'text' });
const Product = mongoose.model('Product', productSchema);

// ─── Scraper Helpers ─────────────────────────────────────────────────────────

async function scrapeWithBrowser(page, url, platform, extractFn) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000)); // Let lazy-load content render
    const products = await page.evaluate(extractFn);
    return products.map(p => ({ ...p, platform }));
  } catch (e) {
    console.log(`    ⚠️ ${platform} failed: ${e.message.slice(0, 60)}`);
    return [];
  }
}

// ─── Platform Extractors (run inside browser context) ────────────────────────

function ajioExtractor() {
  const items = document.querySelectorAll('[class*="item"], [class*="product"], [class*="card"]');
  const products = [];
  items.forEach(el => {
    const titleEl = el.querySelector('[class*="nameCls"], [class*="brand"], h3, [class*="title"]');
    const priceEl = el.querySelector('[class*="price"], [class*="amount"]');
    const imgEl = el.querySelector('img[src*="assets.ajio"], img[src*="akamaized"]');
    const linkEl = el.querySelector('a[href*="/p/"]');
    if (titleEl && priceEl) {
      const priceText = priceEl.textContent.replace(/[^\d]/g, '');
      const price = parseInt(priceText) || 0;
      if (price > 100 && price < 100000 && titleEl.textContent.trim().length > 5) {
        products.push({
          title: titleEl.textContent.trim().slice(0, 100),
          price,
          imageUrl: imgEl?.src || '',
          url: linkEl ? 'https://www.ajio.com' + linkEl.getAttribute('href') : '',
        });
      }
    }
  });
  return products.slice(0, 10);
}

function meeshoExtractor() {
  const cards = document.querySelectorAll('[class*="ProductCard"], [class*="product-card"], [data-testid*="product"]');
  const products = [];
  cards.forEach(el => {
    const title = el.querySelector('p, h4, [class*="name"]')?.textContent?.trim() || '';
    const priceEl = el.querySelector('[class*="price"], span');
    const imgEl = el.querySelector('img');
    const price = parseInt((priceEl?.textContent || '').replace(/[^\d]/g, '')) || 0;
    if (title.length > 5 && price > 50 && price < 50000) {
      products.push({ title: title.slice(0, 100), price, imageUrl: imgEl?.src || '', url: '' });
    }
  });
  return products.slice(0, 10);
}

function nykaaExtractor() {
  const cards = document.querySelectorAll('[class*="product"], [class*="card"], [class*="item"]');
  const products = [];
  cards.forEach(el => {
    const title = el.querySelector('[class*="title"], [class*="name"], h3, p')?.textContent?.trim() || '';
    const priceText = el.querySelector('[class*="price"]')?.textContent || '';
    const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
    const imgEl = el.querySelector('img');
    if (title.length > 8 && price > 100 && price < 100000) {
      products.push({ title: title.slice(0, 100), price, imageUrl: imgEl?.src || '', url: '' });
    }
  });
  return products.slice(0, 10);
}

function tatacliqExtractor() {
  const cards = document.querySelectorAll('[class*="ProductCard"], [class*="product"], [class*="plp-card"]');
  const products = [];
  cards.forEach(el => {
    const title = el.querySelector('[class*="title"], [class*="name"], h3, a')?.textContent?.trim() || '';
    const priceText = el.querySelector('[class*="price"]')?.textContent || '';
    const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
    const imgEl = el.querySelector('img');
    if (title.length > 8 && price > 100 && price < 100000) {
      products.push({ title: title.slice(0, 100), price, imageUrl: imgEl?.src || '', url: '' });
    }
  });
  return products.slice(0, 10);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected');

  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
  console.log('✅ Browser ready\n');

  let totalStored = 0;

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i];
    console.log(`[${i + 1}/${QUERIES.length}] "${query}"`);

    // Ajio
    const ajioProducts = await scrapeWithBrowser(
      page, `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`, 'Ajio', ajioExtractor
    );
    console.log(`    Ajio: ${ajioProducts.length}`);

    // Meesho
    const meeshoProducts = await scrapeWithBrowser(
      page, `https://www.meesho.com/search?q=${encodeURIComponent(query)}`, 'Meesho', meeshoExtractor
    );
    console.log(`    Meesho: ${meeshoProducts.length}`);

    // Nykaa Fashion
    const nykaaProducts = await scrapeWithBrowser(
      page, `https://www.nykaafashion.com/search?q=${encodeURIComponent(query)}`, 'Nykaa Fashion', nykaaExtractor
    );
    console.log(`    Nykaa: ${nykaaProducts.length}`);

    // Tata CLiQ
    const tataProducts = await scrapeWithBrowser(
      page, `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(query)}`, 'Tata CLiQ', tatacliqExtractor
    );
    console.log(`    TataCliq: ${tataProducts.length}`);

    // Store all
    const allProducts = [...ajioProducts, ...meeshoProducts, ...nykaaProducts, ...tataProducts];

    for (const p of allProducts) {
      try {
        await Product.findOneAndUpdate(
          { title: p.title, 'platforms.platform': p.platform, searchQuery: query.toLowerCase() },
          {
            $set: { title: p.title, brand: '', imageUrl: p.imageUrl, searchQuery: query.toLowerCase(), cachedAt: new Date() },
            $addToSet: { platforms: { platform: p.platform, price: p.price, url: p.url } },
          },
          { upsert: true }
        );
        totalStored++;
      } catch { /* skip */ }
    }

    console.log(`    → Stored: ${allProducts.length}\n`);
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
  console.log(`🎉 Done! Stored ${totalStored} products from blocked platforms.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
