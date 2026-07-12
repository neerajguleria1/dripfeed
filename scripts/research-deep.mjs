/**
 * Deep dive — Flipkart image template + Myntra 500 investigation
 * Run: node scripts/research-deep.mjs
 */
import axios from 'axios';
import * as fs from 'fs';

const KEY = '4b561812fdd7833b798e9b1fe8163a82';

// ── Flipkart: understand image URL structure ──────────────────────────────────
async function flipkartImageAudit() {
  console.log('\n=== FLIPKART IMAGE AUDIT ===');
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: {
      api_key: KEY,
      url: `https://www.flipkart.com/search?q=saree&sort=price_asc`,
      render: false,
      country_code: 'in',
    },
    timeout: 25000,
  });

  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
  const state = JSON.parse(jsonMatch[1]);
  const pageData = state?.pageDataV4?.page?.data || {};
  const slots = Object.values(pageData).flat();
  const products = [];
  for (const slot of slots) {
    const p = slot?.widget?.data?.products;
    if (Array.isArray(p)) products.push(...p);
  }

  console.log(`Total products: ${products.length}`);
  
  // Audit all image URL patterns
  const patterns = {};
  for (const p of products) {
    const info = p.productInfo?.value || p;
    const images = info.media?.images || [];
    for (const img of images) {
      const url = img.url || '';
      const pattern = url.includes('{@') ? 'TEMPLATE' : url.startsWith('https://') ? 'HTTPS' : url.startsWith('http://') ? 'HTTP' : 'OTHER';
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    }
  }
  console.log('Image URL patterns:', patterns);

  // Show first 5 raw image URLs
  console.log('\nFirst 5 raw image URLs:');
  for (const p of products.slice(0, 5)) {
    const info = p.productInfo?.value || p;
    const url = info.media?.images?.[0]?.url || 'NONE';
    console.log(' ', url.slice(0, 120));
  }

  // Show what a properly replaced URL looks like
  const sample = products[0];
  const info = sample?.productInfo?.value || sample;
  const rawImg = info.media?.images?.[0]?.url || '';
  const fixed = rawImg.replace('{@width}', '300').replace('{@height}', '400').replace('{@quality}', '70').replace(/^http:/, 'https:');
  console.log('\nRaw:', rawImg.slice(0, 120));
  console.log('Fixed:', fixed.slice(0, 120));

  // Check if there are other image fields
  const firstInfo = products[0]?.productInfo?.value || products[0];
  console.log('\nAll media keys:', JSON.stringify(Object.keys(firstInfo.media || {})));
  console.log('Image object keys:', JSON.stringify(Object.keys(firstInfo.media?.images?.[0] || {})));

  // Check pricing more carefully — the FSP/SPECIAL_PRICE issue
  console.log('\n=== FLIPKART PRICING AUDIT ===');
  let zeroPrice = 0, correctPrice = 0;
  for (const p of products) {
    const info = p.productInfo?.value || p;
    const prices = info.pricing?.prices || [];
    const mrpEntry = prices.find(x => x.strikeOff === true);
    const spEntry = prices.find(x => x.priceType === 'SPECIAL_PRICE');
    const price = spEntry?.value || mrpEntry?.value || 0;
    if (price <= 0) zeroPrice++;
    else correctPrice++;
  }
  console.log(`Price=0: ${zeroPrice}, Price>0: ${correctPrice}`);

  // Show pricing for first 3 products
  for (const p of products.slice(0, 3)) {
    const info = p.productInfo?.value || p;
    const prices = info.pricing?.prices || [];
    const mrpEntry = prices.find(x => x.strikeOff === true);
    const spEntry = prices.find(x => x.priceType === 'SPECIAL_PRICE');
    console.log(`  title: ${(info.titles?.title || '').slice(0, 50)}`);
    console.log(`  mrp: ${mrpEntry?.value}, sp: ${spEntry?.value}, totalDiscount: ${info.pricing?.totalDiscount}`);
  }
}

// ── Myntra: investigate 500 error — try different approaches ─────────────────
async function myntraInvestigate() {
  console.log('\n\n=== MYNTRA 500 INVESTIGATION ===');

  const urls = [
    'https://www.myntra.com/sarees',
    'https://www.myntra.com/search?q=saree',
    'https://www.myntra.com/kurtas',
    'https://www.myntra.com/search?q=kurta',
    'https://www.myntra.com/jeans',
    'https://www.myntra.com/dresses',
  ];

  for (const url of urls) {
    try {
      const { data: html, status } = await axios.get('https://api.scraperapi.com/', {
        params: { api_key: KEY, url, render: true, country_code: 'in' },
        timeout: 70000,
      });
      const len = typeof html === 'string' ? html.length : 0;
      const productIds = typeof html === 'string' ? [...html.matchAll(/"productId"\s*:\s*\d+/g)].length : 0;
      const productBlocks = typeof html === 'string' ? [...html.matchAll(/\{[^{}]*"productId"\s*:\s*\d+[^{}]*\}/g)].length : 0;
      console.log(`${url}`);
      console.log(`  status: ${status}, length: ${len}, productId mentions: ${productIds}, self-contained blocks: ${productBlocks}`);

      // If we got HTML but no blocks, save for inspection
      if (len > 1000 && productBlocks === 0) {
        const fname = `scripts/mn-debug-${url.split('/').pop()}.html`;
        fs.writeFileSync(fname, html.slice(0, 150000));
        console.log(`  ⚠ Saved to ${fname} for inspection`);
        
        // Try to understand the structure
        const hasWindow = html.includes('window.__');
        const hasReact = html.includes('__NEXT_DATA__') || html.includes('__REDUX_STATE__');
        const hasProductName = html.includes('"productName"');
        const hasSearchImage = html.includes('"searchImage"');
        const hasMrp = html.includes('"mrp"');
        console.log(`  window.__: ${hasWindow}, React/Next: ${hasReact}`);
        console.log(`  productName: ${hasProductName}, searchImage: ${hasSearchImage}, mrp: ${hasMrp}`);
        
        // Try to find the actual data structure
        const stateMatch = html.match(/window\.__STATE__\s*=\s*({.{0,200})/);
        const reduxMatch = html.match(/__REDUX_STATE__\s*=\s*({.{0,200})/);
        if (stateMatch) console.log('  __STATE__ found:', stateMatch[1].slice(0, 100));
        if (reduxMatch) console.log('  __REDUX_STATE__ found:', reduxMatch[1].slice(0, 100));
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log(`${url}`);
      console.log(`  ERROR: ${e.response?.status || e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ── Google Shopping: understand thumbnail + link structure ────────────────────
async function googleShoppingAudit() {
  console.log('\n\n=== GOOGLE SHOPPING DEEP AUDIT ===');
  const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
    params: { api_key: KEY, query: 'saree women', country_code: 'in', tld: 'co.in' },
    timeout: 45000,
  });
  const results = data?.shopping_results || [];
  console.log(`Total: ${results.length}`);

  // Thumbnail audit
  let httpsThumb = 0, base64Thumb = 0, noThumb = 0;
  for (const r of results) {
    if (!r.thumbnail) noThumb++;
    else if (r.thumbnail.startsWith('https://')) httpsThumb++;
    else if (r.thumbnail.startsWith('data:')) base64Thumb++;
    else noThumb++;
  }
  console.log(`Thumbnails: https=${httpsThumb}, base64=${base64Thumb}, none=${noThumb}`);

  // Link audit — can we extract real URLs?
  console.log('\nLink patterns (first 5):');
  for (const r of results.slice(0, 5)) {
    console.log(`  source: ${r.source}`);
    console.log(`  link: ${r.link?.slice(0, 100)}`);
    // Try to extract real URL
    try {
      const u = new URL(r.link);
      const target = u.searchParams.get('url');
      if (target) console.log(`  extracted: ${decodeURIComponent(target).slice(0, 100)}`);
    } catch {}
    console.log('');
  }

  // Price audit
  const prices = results.map(r => r.extracted_price || 0);
  const zeroPrices = prices.filter(p => p <= 0).length;
  const lowPrices = prices.filter(p => p > 0 && p <= 100).length;
  console.log(`Price audit: zero=${zeroPrices}, <=100=${lowPrices}, valid=${results.length - zeroPrices - lowPrices}`);

  // Source diversity
  const sources = [...new Set(results.map(r => r.source))];
  console.log(`Sources (${sources.length}): ${sources.join(', ')}`);
}

// ── Amazon: check original_price structure ────────────────────────────────────
async function amazonPriceAudit() {
  console.log('\n\n=== AMAZON PRICE STRUCTURE AUDIT ===');
  const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
    params: { api_key: KEY, query: 'saree women', country_code: 'in', tld: 'in', page: 1 },
    timeout: 30000,
  });
  const products = data?.results || data?.organic_results || [];
  console.log(`Total: ${products.length}`);

  // original_price structure
  let origAsObj = 0, origAsNum = 0, origAsStr = 0, noOrig = 0;
  for (const p of products) {
    if (!p.original_price) noOrig++;
    else if (typeof p.original_price === 'object') origAsObj++;
    else if (typeof p.original_price === 'number') origAsNum++;
    else origAsStr++;
  }
  console.log(`original_price: object=${origAsObj}, number=${origAsNum}, string=${origAsStr}, missing=${noOrig}`);

  // Show first 3 with original_price as object
  const withObj = products.filter(p => typeof p.original_price === 'object' && p.original_price);
  if (withObj.length) {
    console.log('\noriginal_price object structure:');
    console.log(JSON.stringify(withObj[0].original_price));
  }

  // Price=0 audit
  const zeroPrices = products.filter(p => {
    const price = typeof p.price === 'number' ? p.price : 0;
    return price <= 0;
  });
  console.log(`\nPrice=0 products: ${zeroPrices.length}`);
  if (zeroPrices.length) {
    console.log('First zero-price product:', JSON.stringify(zeroPrices[0]).slice(0, 200));
  }
}

async function main() {
  await flipkartImageAudit();
  await myntraInvestigate();
  await googleShoppingAudit();
  await amazonPriceAudit();
  console.log('\n\nDEEP RESEARCH COMPLETE');
}

main().catch(console.error);
