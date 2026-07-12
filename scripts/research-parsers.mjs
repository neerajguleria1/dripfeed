/**
 * Deep research script — tests ALL parsers against live ScraperAPI responses
 * and prints exactly what fields come back, so we can harden the parsers.
 *
 * Run: node scripts/research-parsers.mjs
 */
import axios from 'axios';
import * as fs from 'fs';

const KEY = '4b561812fdd7833b798e9b1fe8163a82';
const QUERIES = ['saree', 'kurta', 'jeans', 'dress', 'sneakers', 'lehenga', 'kurti', 'trousers'];

// ── helpers ──────────────────────────────────────────────────────────────────
function parsePrice(t) {
  if (typeof t === 'number') return Math.round(t);
  const m = String(t).replace(/[₹,\s]/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}
function cleanText(t) {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

// ── Amazon ────────────────────────────────────────────────────────────────────
async function testAmazon(query) {
  console.log(`\n${'='.repeat(60)}\nAMAZON: "${query}"\n${'='.repeat(60)}`);
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params: { api_key: KEY, query, country_code: 'in', tld: 'in', page: 1 },
      timeout: 30000,
    });
    const products = data?.results || data?.organic_results || [];
    console.log(`  Raw count: ${products.length}`);
    if (products.length) {
      const p = products[0];
      console.log('  First product keys:', Object.keys(p).join(', '));
      console.log('  title:', p.name || p.title);
      console.log('  price field:', p.price, '| type:', typeof p.price);
      console.log('  original_price:', p.original_price);
      console.log('  image:', (p.image || p.thumbnail || '').slice(0, 80));
      console.log('  asin:', p.asin);
      console.log('  brand:', p.brand);
      // Check for any price=0 or missing image
      const bad = products.filter(p => {
        const price = typeof p.price === 'number' ? p.price : parsePrice(p.price || '0');
        const img = p.image || p.thumbnail || '';
        return price <= 0 || !img.startsWith('https://');
      });
      console.log(`  ⚠ Bad products (price=0 or bad image): ${bad.length}/${products.length}`);
    }
  } catch (e) {
    console.log('  ERROR:', e.message);
  }
}

// ── Flipkart ──────────────────────────────────────────────────────────────────
async function testFlipkart(query) {
  console.log(`\n${'='.repeat(60)}\nFLIPKART: "${query}"\n${'='.repeat(60)}`);
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: KEY,
        url: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`,
        render: false,
        country_code: 'in',
      },
      timeout: 25000,
    });
    if (typeof html !== 'string') { console.log('  Not a string response'); return; }

    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (!jsonMatch) {
      console.log('  ⚠ No __INITIAL_STATE__ found');
      // Save HTML for inspection
      fs.writeFileSync(`scripts/fk-debug-${query}.html`, html.slice(0, 50000));
      console.log(`  Saved first 50k chars to scripts/fk-debug-${query}.html`);
      return;
    }

    const state = JSON.parse(jsonMatch[1]);
    const pageData = state?.pageDataV4?.page?.data || {};
    const slots = Object.values(pageData).flat();
    const products = [];
    for (const slot of slots) {
      const p = slot?.widget?.data?.products;
      if (Array.isArray(p)) products.push(...p);
    }
    console.log(`  Raw product count: ${products.length}`);
    if (products.length) {
      const p = products[0];
      const info = p.productInfo?.value || p;
      console.log('  info keys:', Object.keys(info).join(', '));
      console.log('  title:', info.titles?.title || info.titles?.newTitle);
      console.log('  pricing keys:', Object.keys(info.pricing || {}).join(', '));
      const prices = info.pricing?.prices || [];
      console.log('  prices array:', JSON.stringify(prices.slice(0, 3)));
      const rawImg = info.media?.images?.[0]?.url || '';
      console.log('  raw image:', rawImg.slice(0, 80));
      // Check for template placeholders not replaced
      const hasTemplate = products.some(p => {
        const img = (p.productInfo?.value || p).media?.images?.[0]?.url || '';
        return img.includes('{@');
      });
      console.log(`  ⚠ Has unreplaced template URLs: ${hasTemplate}`);
    }
  } catch (e) {
    console.log('  ERROR:', e.message);
  }
}

// ── Myntra ────────────────────────────────────────────────────────────────────
const SLUG_MAP = {
  saree: 'sarees', kurta: 'kurtas', jean: 'jeans', trouser: 'trousers',
  legging: 'leggings', dress: 'dresses', skirt: 'skirts', top: 'tops',
  shoe: 'shoes', sandal: 'sandals', sneaker: 'sneakers', boot: 'boots',
  jacket: 'jackets', blazer: 'blazers', hoodie: 'hoodies', shirt: 'shirts',
  pant: 'pants', short: 'shorts', suit: 'suits', coat: 'coats',
  bag: 'bags', watch: 'watches', sari: 'sarees',
};

function buildMyntraUrl(query) {
  const q = query.toLowerCase().trim();
  if (/under\s*\d+|below\s*\d+|\d+\s*to\s*\d+/.test(q)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const BAD_SLUGS = new Set(['kurti', 'jean', 'kurtas', 'jeans under', 'ladies', 'gents', 'women', 'men']);
  if (BAD_SLUGS.has(q)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const BRANDS = new Set(['levis', 'zara', 'h&m', 'hm', 'puma', 'adidas', 'reebok', 'gap', 'mango', 'only', 'vero', 'forever']);
  const words = q.split(' ');
  if (words.length >= 2 && BRANDS.has(words[0])) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const slug = q.replace(/\s+/g, '-');
  const corrected = SLUG_MAP[q] || slug;
  return `https://www.myntra.com/${corrected}`;
}

async function testMyntra(query) {
  const url = buildMyntraUrl(query);
  console.log(`\n${'='.repeat(60)}\nMYNTRA: "${query}" → ${url}\n${'='.repeat(60)}`);
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: { api_key: KEY, url, render: true, country_code: 'in' },
      timeout: 70000,
    });
    if (typeof html !== 'string') { console.log('  Not a string'); return; }

    // Strategy 1: self-contained product blocks (current approach)
    const productBlocks = [...html.matchAll(/\{[^{}]*"productId"\s*:\s*\d+[^{}]*\}/g)].map(m => m[0]);
    console.log(`  Strategy1 (self-contained blocks): ${productBlocks.length} blocks`);

    if (productBlocks.length > 0) {
      const b = productBlocks[0];
      console.log('  First block:', b.slice(0, 300));
      // Check all required fields present
      const hasName = productBlocks.filter(b => b.includes('"productName"')).length;
      const hasMrp = productBlocks.filter(b => b.includes('"mrp"')).length;
      const hasImg = productBlocks.filter(b => b.includes('"searchImage"')).length;
      const hasSlug = productBlocks.filter(b => b.includes('"pdpUrl"')).length;
      const hasBrand = productBlocks.filter(b => b.includes('"brand"')).length;
      console.log(`  Fields present: name=${hasName}, mrp=${hasMrp}, img=${hasImg}, slug=${hasSlug}, brand=${hasBrand} / ${productBlocks.length} total`);

      // Check for blocks where productName is missing (would give empty title)
      const missingName = productBlocks.filter(b => !b.includes('"productName"')).length;
      const missingImg = productBlocks.filter(b => !b.includes('"searchImage"')).length;
      if (missingName) console.log(`  ⚠ ${missingName} blocks missing productName`);
      if (missingImg) console.log(`  ⚠ ${missingImg} blocks missing searchImage`);
    } else {
      // Strategy 2: try broader JSON extraction
      console.log('  ⚠ No self-contained blocks found — trying broader extraction...');
      const allProductIds = [...html.matchAll(/"productId"\s*:\s*(\d+)/g)].map(m => m[1]);
      const allNames = [...html.matchAll(/"productName"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
      const allImages = [...html.matchAll(/"searchImage"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
      console.log(`  productId count: ${allProductIds.length}`);
      console.log(`  productName count: ${allNames.length}`);
      console.log(`  searchImage count: ${allImages.length}`);
      // Save for inspection
      fs.writeFileSync(`scripts/mn-debug-${query}.html`, html.slice(0, 100000));
      console.log(`  Saved first 100k chars to scripts/mn-debug-${query}.html`);
    }

    // Strategy 3: check if Myntra returned a JSON API response instead of HTML
    if (html.trim().startsWith('{') || html.trim().startsWith('[')) {
      console.log('  ℹ Response looks like JSON, not HTML');
      try {
        const json = JSON.parse(html);
        console.log('  JSON keys:', Object.keys(json).join(', '));
      } catch {}
    }

    // Check for redirect/empty page
    if (html.includes('No results found') || html.includes('0 results')) {
      console.log('  ⚠ Page says no results');
    }
    if (html.includes('myntra.com/') && html.length < 5000) {
      console.log('  ⚠ Very short response — likely a redirect or error page');
    }

  } catch (e) {
    console.log('  ERROR:', e.message);
  }
}

// ── Google Shopping ───────────────────────────────────────────────────────────
async function testGoogleShopping(query) {
  console.log(`\n${'='.repeat(60)}\nGOOGLE SHOPPING: "${query}"\n${'='.repeat(60)}`);
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
      params: { api_key: KEY, query, country_code: 'in', tld: 'co.in' },
      timeout: 45000,
    });
    const results = data?.shopping_results || [];
    console.log(`  Raw count: ${results.length}`);
    if (results.length) {
      const r = results[0];
      console.log('  First result keys:', Object.keys(r).join(', '));
      console.log('  title:', r.title);
      console.log('  price:', r.price);
      console.log('  source:', r.source);
      console.log('  thumbnail type:', typeof r.thumbnail, r.thumbnail?.slice(0, 60));
      console.log('  link:', r.link?.slice(0, 80));

      // Audit all results
      const noImg = results.filter(r => !r.thumbnail || (!r.thumbnail.startsWith('https://') && !r.thumbnail.startsWith('data:'))).length;
      const badPrice = results.filter(r => parsePrice(r.price || '0') <= 100).length;
      const noTitle = results.filter(r => !r.title || r.title.length < 8).length;
      const sources = [...new Set(results.map(r => r.source))];
      console.log(`  ⚠ No/bad image: ${noImg}, bad price: ${badPrice}, no title: ${noTitle}`);
      console.log(`  Sources: ${sources.join(', ')}`);
    }
  } catch (e) {
    console.log('  ERROR:', e.message);
  }
}

// ── Run all tests ─────────────────────────────────────────────────────────────
async function main() {
  // Test 2 queries per platform to keep credit usage low
  const testQueries = ['saree', 'kurta'];

  for (const q of testQueries) {
    await testAmazon(q);
    await new Promise(r => setTimeout(r, 1000));
    await testFlipkart(q);
    await new Promise(r => setTimeout(r, 1000));
    await testMyntra(q);
    await new Promise(r => setTimeout(r, 1000));
    await testGoogleShopping(q);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n\nDONE. Check scripts/mn-debug-*.html and scripts/fk-debug-*.html if saved.');
}

main().catch(console.error);
