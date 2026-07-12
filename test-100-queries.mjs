// test-100-queries.mjs
// Tests 100 common product searches against the live search logic
// Run: node test-100-queries.mjs

import axios from 'axios';

const SCRAPER_KEY = '62dab316fd542f8324cfcd3c396e0674';

const QUERIES = [
  // Footwear (10)
  'shoes', 'sneakers', 'sports shoes', 'casual shoes', 'running shoes',
  'heels', 'sandals', 'boots', 'loafers', 'flip flops',
  // Tops / Shirts (10)
  'shirt men', 'tshirt men', 'polo shirt', 'formal shirt', 'kurta men',
  'top women', 'blouse women', 'crop top', 'tank top', 'kurti women',
  // Bottoms (10)
  'jeans men', 'jeans women', 'trousers men', 'leggings women', 'shorts men',
  'skirt women', 'palazzos women', 'cargo pants', 'chinos men', 'joggers',
  // Dresses / Ethnic (10)
  'dress women', 'maxi dress', 'saree', 'salwar suit', 'anarkali',
  'lehenga', 'kurta set women', 'ethnic wear women', 'indo western', 'sharara',
  // Outerwear (8)
  'jacket men', 'jacket women', 'hoodie men', 'blazer men', 'blazer women',
  'coat women', 'windbreaker', 'denim jacket',
  // Sports / Gym (8)
  'gym wear men', 'gym wear women', 'track pants', 'sports bra', 'compression shorts',
  'yoga pants', 'cycling shorts', 'football jersey',
  // Accessories (10)
  'watch men', 'watch women', 'sunglasses men', 'sunglasses women', 'belt men',
  'wallet men', 'handbag women', 'backpack', 'cap men', 'socks',
  // Brands (10)
  'adidas shoes', 'nike shoes', 'puma shoes', 'levis jeans', 'zara dress',
  'h&m top', 'reebok shoes', 'woodland shoes', 'bata shoes', 'fastrack watch',
  // Hinglish / Mixed (8)
  'kapde women', 'joote men', 'ghagra choli', 'pathani suit', 'sherwani men',
  'churidar women', 'dupatta', 'mojari',
  // Price-intent (8)
  'tshirt under 500', 'shoes under 1000', 'saree under 2000', 'watch under 3000',
  'jeans under 1500', 'dress under 1000', 'kurta under 800', 'sneakers under 2000',
  // Typos / Common misspellings (8)
  'addidas shoes', 'niike shoes', 'shrit men', 'trouser women', 'sandle women',
  'jaket men', 'kurthi women', 'leggigns women',
  // Kids (5)
  'kids shoes', 'kids tshirt', 'kids dress', 'baby clothes', 'school bag',
  // Misc (5)
  'innerwear men', 'innerwear women', 'nightwear women', 'swimwear', 'raincoat',
];

// ─── Helpers (mirrors search.ts logic) ───────────────────────────────────────

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

const MYNTRA_500_SLUGS = new Set([
  'sarees', 'jeans', 'dresses', 'leggings', 'skirts', 'tops',
  'blazers', 'hoodies', 'pants', 'shorts', 'suits', 'coats', 'bags', 'watches',
]);

const SLUG_MAP = {
  saree: 'sarees', kurta: 'kurtas', jean: 'jeans', trouser: 'trousers',
  legging: 'leggings', dress: 'dresses', skirt: 'skirts', top: 'tops',
  shoe: 'footwear', sandal: 'sandals', sneaker: 'sneakers', boot: 'boots',
  jacket: 'jackets', blazer: 'blazers', hoodie: 'hoodies', shirt: 'shirts',
  pant: 'pants', short: 'shorts', suit: 'suits', coat: 'coats',
  bag: 'bags', watch: 'watches', sari: 'sarees',
};

function buildMyntraUrl(query) {
  const q = query.toLowerCase().trim();
  if (/under\s*\d+|below\s*\d+|\d+\s*to\s*\d+/.test(q)) {
    return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  }
  const BAD_SLUGS = new Set(['kurti', 'jean', 'kurtas', 'ladies', 'gents', 'women', 'men']);
  if (BAD_SLUGS.has(q)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const BRANDS = new Set(['levis', 'zara', 'h&m', 'hm', 'puma', 'adidas', 'reebok', 'gap', 'mango', 'only', 'vero', 'forever']);
  const words = q.split(' ');
  if (words.length >= 2 && BRANDS.has(words[0])) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const corrected = SLUG_MAP[q] || q.replace(/\s+/g, '-');
  if (MYNTRA_500_SLUGS.has(corrected)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  return `https://www.myntra.com/${corrected}`;
}

// ─── Platform testers ─────────────────────────────────────────────────────────

async function testAmazon(query) {
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params: { api_key: SCRAPER_KEY, query, country_code: 'in', tld: 'in', page: 1 },
      timeout: 25000,
    });
    const products = data?.results || data?.organic_results || [];
    const valid = products.filter(p => {
      const price = typeof p.price === 'number' ? p.price : parsePrice(p.price || '0');
      return price > 0 && (p.name || p.title || '').length >= 5;
    });
    return { ok: valid.length > 0, count: valid.length };
  } catch (e) {
    return { ok: false, count: 0, err: e?.response?.status || e?.code || 'ERR' };
  }
}

async function testFlipkart(query) {
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: SCRAPER_KEY,
        url: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`,
        render: false, country_code: 'in',
      },
      timeout: 20000,
    });
    if (typeof html !== 'string') return { ok: false, count: 0, err: 'NOT_STRING' };
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (!jsonMatch) return { ok: false, count: 0, err: 'NO_INITIAL_STATE' };
    const state = JSON.parse(jsonMatch[1]);
    const pageData = state?.pageDataV4?.page?.data || {};
    const slots = Object.values(pageData).flat();
    const products = [];
    for (const slot of slots) {
      const p = slot?.widget?.data?.products;
      if (Array.isArray(p)) products.push(...p);
    }
    return { ok: products.length > 0, count: products.length };
  } catch (e) {
    return { ok: false, count: 0, err: e?.response?.status || e?.code || 'ERR' };
  }
}

async function testMyntra(query) {
  const url = buildMyntraUrl(query);
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: { api_key: SCRAPER_KEY, url, render: true, country_code: 'in' },
      timeout: 65000,
    });
    if (typeof html !== 'string') return { ok: false, count: 0, err: 'NOT_STRING', url };
    const startIdx = html.indexOf('"products":[{');
    if (startIdx < 0) return { ok: false, count: 0, err: 'NO_PRODUCTS_KEY', url };
    // Count products by counting balanced objects
    let count = 0, i = startIdx + '"products":'.length;
    while (i < html.length && html[i] !== '[') i++;
    i++;
    while (i < html.length) {
      if (html[i] === '{') {
        let depth = 0;
        while (i < html.length) {
          if (html[i] === '{') depth++;
          else if (html[i] === '}') { depth--; if (depth === 0) { count++; i++; break; } }
          i++;
        }
      } else if (html[i] === ']') break;
      else i++;
    }
    return { ok: count > 0, count, url };
  } catch (e) {
    return { ok: false, count: 0, err: e?.response?.status || e?.code || 'ERR', url };
  }
}

async function testGoogle(query) {
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
      params: { api_key: SCRAPER_KEY, query, country_code: 'in', tld: 'co.in' },
      timeout: 45000,
    });
    const results = data?.shopping_results || [];
    const valid = results.filter(r => parsePrice(r.price || '0') > 100 && (r.title || '').length >= 8 && r.link);
    return { ok: valid.length > 0, count: valid.length };
  } catch (e) {
    return { ok: false, count: 0, err: e?.response?.status || e?.code || 'ERR' };
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const CONCURRENCY = 3; // test 3 queries at a time to avoid rate limits
const PLATFORM = process.argv[2] || 'amazon'; // amazon | flipkart | myntra | google

const testers = {
  amazon: testAmazon,
  flipkart: testFlipkart,
  myntra: testMyntra,
  google: testGoogle,
};

const tester = testers[PLATFORM];
if (!tester) {
  console.error(`Unknown platform: ${PLATFORM}. Use: amazon | flipkart | myntra | google`);
  process.exit(1);
}

console.log(`\n🔍 Testing ${QUERIES.length} queries on ${PLATFORM.toUpperCase()}\n`);
console.log('─'.repeat(70));

let passed = 0, failed = 0;
const failures = [];

async function runBatch(batch) {
  return Promise.all(batch.map(async (query) => {
    const result = await tester(query);
    const icon = result.ok ? '✅' : '❌';
    const detail = result.ok
      ? `${result.count} products`
      : `FAIL${result.err ? ` (${result.err})` : ''}`;
    console.log(`${icon} [${query.padEnd(30)}] ${detail}`);
    if (result.ok) passed++;
    else { failed++; failures.push({ query, ...result }); }
  }));
}

for (let i = 0; i < QUERIES.length; i += CONCURRENCY) {
  await runBatch(QUERIES.slice(i, i + CONCURRENCY));
  if (i + CONCURRENCY < QUERIES.length) await new Promise(r => setTimeout(r, 1000));
}

console.log('\n' + '─'.repeat(70));
console.log(`\n📊 RESULTS: ${passed}/${QUERIES.length} passed, ${failed} failed\n`);

if (failures.length) {
  console.log('❌ FAILED QUERIES:');
  failures.forEach(f => {
    const extra = f.url ? `\n     URL: ${f.url}` : '';
    console.log(`   • ${f.query} → ${f.err || 'no results'}${extra}`);
  });
}
