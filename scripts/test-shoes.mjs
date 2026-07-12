import axios from 'axios';

const KEY = '4b561812fdd7833b798e9b1fe8163a82';

function parsePrice(t) {
  if (typeof t === 'number') return Math.round(t);
  const s = String(t).replace(/[₹\s]/g, '').trim();
  const dotIdx = s.lastIndexOf('.');
  const commaIdx = s.lastIndexOf(',');
  let normalized = s;
  if (dotIdx > 0 && commaIdx < 0) {
    const afterDot = s.slice(dotIdx + 1);
    if (afterDot.length === 3) normalized = s.replace(/\./g, '');
    else normalized = s.replace(/,/g, '');
  } else {
    normalized = s.replace(/,/g, '');
  }
  const m = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

function cleanText(t) {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
}

// ── Amazon ────────────────────────────────────────────────────────────────────
async function testAmazon(query) {
  console.log(`\n=== AMAZON: "${query}" ===`);
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params: { api_key: KEY, query, country_code: 'in', tld: 'in', page: 1 },
      timeout: 30000,
    });
    const raw = data?.results || data?.organic_results || [];
    const products = raw.map(p => {
      const price = typeof p.price === 'number' ? p.price : parsePrice(p.price || '0');
      const orig = typeof p.original_price === 'object' && p.original_price
        ? (p.original_price.price || 0)
        : parsePrice(p.original_price || '0');
      return { title: cleanText(p.name || p.title || ''), price, orig, img: p.image || p.thumbnail || '', asin: p.asin };
    }).filter(p => p.price > 0 && p.img.startsWith('https://'));

    console.log(`  Total valid: ${products.length} / ${raw.length} raw`);
    const prices = products.map(p => p.price).sort((a,b) => a-b);
    console.log(`  Price range: ₹${prices[0]} – ₹${prices[prices.length-1]}`);
    console.log(`  Under ₹500: ${products.filter(p => p.price < 500).length}`);
    console.log(`  Under ₹1000: ${products.filter(p => p.price < 1000).length}`);
    console.log(`  First 5 products:`);
    for (const p of products.slice(0, 5)) {
      console.log(`    ₹${p.price} | ${p.title.slice(0, 60)}`);
    }
  } catch(e) { console.log('  ERROR:', e.message); }
}

// ── Flipkart ──────────────────────────────────────────────────────────────────
async function testFlipkart(query) {
  console.log(`\n=== FLIPKART: "${query}" ===`);
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: { api_key: KEY, url: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`, render: false, country_code: 'in' },
      timeout: 25000,
    });
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (!jsonMatch) { console.log('  No __INITIAL_STATE__'); return; }
    const state = JSON.parse(jsonMatch[1]);
    const pageData = state?.pageDataV4?.page?.data || {};
    const slots = Object.values(pageData).flat();
    const rawProducts = [];
    for (const slot of slots) {
      const p = slot?.widget?.data?.products;
      if (Array.isArray(p)) rawProducts.push(...p);
    }
    const products = rawProducts.map((p, i) => {
      const info = p.productInfo?.value || p;
      const prices = info.pricing?.prices || [];
      const mrpEntry = prices.find(x => x.strikeOff === true);
      const spEntry = prices.find(x => x.priceType === 'SPECIAL_PRICE');
      const price = spEntry?.value || mrpEntry?.value || 0;
      const rawImg = info.media?.images?.[0]?.url || '';
      const img = rawImg.replace('{@width}', '300').replace('{@height}', '400').replace('{@quality}', '70').replace(/^http:\/\//, 'https://');
      return { title: cleanText(info.titles?.title || ''), price, img };
    }).filter(p => p.price > 0 && p.img.startsWith('https://'));

    console.log(`  Total valid: ${products.length} / ${rawProducts.length} raw`);
    const prices = products.map(p => p.price).sort((a,b) => a-b);
    console.log(`  Price range: ₹${prices[0]} – ₹${prices[prices.length-1]}`);
    console.log(`  Under ₹500: ${products.filter(p => p.price < 500).length}`);
    console.log(`  Under ₹1000: ${products.filter(p => p.price < 1000).length}`);
    for (const p of products.slice(0, 5)) {
      console.log(`    ₹${p.price} | ${p.title.slice(0, 60)}`);
    }
  } catch(e) { console.log('  ERROR:', e.message); }
}

// ── Myntra ────────────────────────────────────────────────────────────────────
function extractMyntraProducts(html) {
  const startIdx = html.indexOf('"products":[{');
  if (startIdx < 0) return [];
  const objects = [];
  let i = startIdx + '"products":'.length;
  while (i < html.length && html[i] !== '[') i++;
  i++;
  while (i < html.length) {
    if (html[i] === '{') {
      let depth = 0, objStart = i;
      while (i < html.length) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}') { depth--; if (depth === 0) { try { objects.push(JSON.parse(html.slice(objStart, i+1))); } catch {} i++; break; } }
        i++;
      }
    } else if (html[i] === ']') break;
    else i++;
  }
  return objects;
}

async function testMyntra(query) {
  // Test multiple URL strategies for shoes
  const urls = [
    { label: 'slug /shoes', url: 'https://www.myntra.com/shoes' },
    { label: 'search?q=shoes', url: 'https://www.myntra.com/search?q=shoes' },
    { label: 'search?q=footwear', url: 'https://www.myntra.com/search?q=footwear' },
    { label: 'slug /footwear', url: 'https://www.myntra.com/footwear' },
    { label: 'search?q=sneakers', url: 'https://www.myntra.com/search?q=sneakers' },
  ];

  for (const { label, url } of urls) {
    console.log(`\n=== MYNTRA: "${label}" ===`);
    try {
      const { data: html, status } = await axios.get('https://api.scraperapi.com/', {
        params: { api_key: KEY, url, render: true, country_code: 'in' },
        timeout: 70000,
      });
      if (typeof html !== 'string') { console.log('  Non-string response'); continue; }
      const raw = extractMyntraProducts(html);
      const products = raw.map(p => ({
        title: `${p.brand || ''} ${p.productName || p.product || ''}`.trim(),
        price: p.price || 0,
        mrp: p.mrp || 0,
        img: (p.searchImage || '').replace(/^http:\/\//, 'https://'),
      })).filter(p => p.price > 0 && p.img.startsWith('https://'));

      console.log(`  Status: ${status}, raw: ${raw.length}, valid: ${products.length}`);
      if (products.length > 0) {
        const prices = products.map(p => p.price).sort((a,b) => a-b);
        console.log(`  Price range: ₹${prices[0]} – ₹${prices[prices.length-1]}`);
        console.log(`  Under ₹500: ${products.filter(p => p.price < 500).length}`);
        console.log(`  Under ₹1000: ${products.filter(p => p.price < 1000).length}`);
        for (const p of products.slice(0, 3)) {
          console.log(`    ₹${p.price} (mrp ₹${p.mrp}) | ${p.title.slice(0, 55)}`);
        }
      }
    } catch(e) { console.log(`  ERROR: ${e.response?.status || e.message}`); }
    await new Promise(r => setTimeout(r, 2000));
  }
}

// ── Google Shopping ───────────────────────────────────────────────────────────
async function testGoogle(query) {
  console.log(`\n=== GOOGLE SHOPPING: "${query}" ===`);
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
      params: { api_key: KEY, query, country_code: 'in', tld: 'co.in' },
      timeout: 45000,
    });
    const SKIP = new Set(['amazon.in', 'flipkart', 'myntra']);
    const results = (data?.shopping_results || []).filter(r => {
      const s = (r.source || '').toLowerCase();
      return !Array.from(SKIP).some(p => s.includes(p));
    });
    const products = results.map(r => ({
      title: r.title || '',
      price: parsePrice(r.price || '0'),
      source: r.source,
    })).filter(p => p.price > 100 && p.title.length >= 5);

    console.log(`  Valid: ${products.length} / ${results.length} non-AMZ-FK-MN`);
    if (products.length > 0) {
      const prices = products.map(p => p.price).sort((a,b) => a-b);
      console.log(`  Price range: ₹${prices[0]} – ₹${prices[prices.length-1]}`);
      console.log(`  Under ₹500: ${products.filter(p => p.price < 500).length}`);
      const sources = [...new Set(products.map(p => p.source))];
      console.log(`  Sources: ${sources.join(', ')}`);
      for (const p of products.slice(0, 3)) {
        console.log(`    ₹${p.price} [${p.source}] | ${p.title.slice(0, 55)}`);
      }
    }
  } catch(e) { console.log('  ERROR:', e.message); }
}

async function main() {
  await testAmazon('shoes');
  await new Promise(r => setTimeout(r, 1000));
  await testFlipkart('shoes');
  await new Promise(r => setTimeout(r, 1000));
  await testMyntra('shoes');
  await new Promise(r => setTimeout(r, 1000));
  await testGoogle('shoes india');
  console.log('\n\nDONE');
}
main().catch(console.error);
