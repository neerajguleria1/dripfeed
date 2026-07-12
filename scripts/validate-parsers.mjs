/**
 * Final validation — tests all parsers with the new code logic
 * Run: node scripts/validate-parsers.mjs
 */
import axios from 'axios';

const KEY = '4b561812fdd7833b798e9b1fe8163a82';

// ── Replicate the fixed parsePrice ────────────────────────────────────────────
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
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

function isValidProduct(p) {
  const t = p.title.trim();
  if (p.price <= 0) return false;
  if (t.length < 5) return false;
  if (!p.imageUrl || (!p.imageUrl.startsWith('https://') && !p.imageUrl.startsWith('data:'))) return false;
  return true;
}

// ── Amazon validation ─────────────────────────────────────────────────────────
async function validateAmazon(query) {
  const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
    params: { api_key: KEY, query, country_code: 'in', tld: 'in', page: 1 },
    timeout: 30000,
  });
  const raw = data?.results || data?.organic_results || [];
  const products = raw.map((p, i) => {
    const price = typeof p.price === 'number' ? p.price : parsePrice(p.price || '0');
    const orig = typeof p.original_price === 'object' && p.original_price !== null
      ? (p.original_price.price || 0)
      : typeof p.original_price === 'number' ? p.original_price : parsePrice(p.original_price || '0');
    const imageUrl = (p.image || p.thumbnail || '');
    return {
      title: cleanText(p.name || p.title || ''),
      price,
      originalPrice: orig > price ? orig : undefined,
      imageUrl: imageUrl.startsWith('https://') ? imageUrl : '',
      platform: 'Amazon India',
    };
  }).filter(isValidProduct);

  const issues = products.filter(p => p.price <= 0 || !p.imageUrl || !p.title);
  console.log(`Amazon "${query}": ${products.length} valid / ${raw.length} raw | issues: ${issues.length}`);
  if (products.length > 0) {
    const p = products[0];
    console.log(`  ✓ Sample: "${p.title.slice(0, 50)}" ₹${p.price} img:${p.imageUrl.slice(0, 50)}`);
  }
}

// ── Flipkart validation ───────────────────────────────────────────────────────
async function validateFlipkart(query) {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: KEY, url: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`, render: false, country_code: 'in' },
    timeout: 25000,
  });
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
  if (!jsonMatch) { console.log(`Flipkart "${query}": No __INITIAL_STATE__`); return; }
  const state = JSON.parse(jsonMatch[1]);
  const pageData = state?.pageDataV4?.page?.data || {};
  const slots = Object.values(pageData).flat();
  const rawProducts = [];
  for (const slot of slots) {
    const p = slot?.widget?.data?.products;
    if (Array.isArray(p)) rawProducts.push(...p);
  }

  const products = rawProducts.slice(0, 20).map((p, i) => {
    const info = p.productInfo?.value || p;
    const prices = info.pricing?.prices || [];
    const mrpEntry = prices.find(x => x.strikeOff === true);
    const spEntry = prices.find(x => x.priceType === 'SPECIAL_PRICE');
    const price = spEntry?.value || mrpEntry?.value || 0;
    const rawImg = info.media?.images?.[0]?.url || '';
    const imageUrl = rawImg.replace('{@width}', '300').replace('{@height}', '400').replace('{@quality}', '70').replace(/^http:\/\//, 'https://');
    return {
      title: cleanText(info.titles?.title || info.titles?.newTitle || ''),
      price,
      imageUrl,
      platform: 'Flipkart',
    };
  }).filter(isValidProduct);

  const templateLeft = products.filter(p => p.imageUrl.includes('{@')).length;
  const httpLeft = products.filter(p => p.imageUrl.startsWith('http://')).length;
  console.log(`Flipkart "${query}": ${products.length} valid / ${rawProducts.length} raw | template URLs left: ${templateLeft} | http:// left: ${httpLeft}`);
  if (products.length > 0) {
    const p = products[0];
    console.log(`  ✓ Sample: "${p.title.slice(0, 50)}" ₹${p.price} img:${p.imageUrl.slice(0, 60)}`);
  }
}

// ── Myntra validation ─────────────────────────────────────────────────────────
function extractMyntraProducts(html) {
  const startMarker = '"products":[{';
  const startIdx = html.indexOf(startMarker);
  if (startIdx < 0) return [];
  const arrayStart = startIdx + '"products":'.length;
  const objects = [];
  let i = arrayStart;
  while (i < html.length && html[i] !== '[') i++;
  i++;
  while (i < html.length) {
    if (html[i] === '{') {
      let depth = 0;
      const objStart = i;
      while (i < html.length) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}') {
          depth--;
          if (depth === 0) {
            try { objects.push(JSON.parse(html.slice(objStart, i + 1))); } catch {}
            i++;
            break;
          }
        }
        i++;
      }
    } else if (html[i] === ']') break;
    else i++;
  }
  return objects;
}

const MYNTRA_500_SLUGS = new Set(['sarees', 'jeans', 'dresses', 'leggings', 'skirts', 'tops', 'shoes', 'sandals', 'sneakers', 'boots', 'blazers', 'hoodies', 'pants', 'shorts', 'suits', 'coats', 'bags', 'watches']);
const SLUG_MAP = { saree: 'sarees', kurta: 'kurtas', jean: 'jeans', trouser: 'trousers', dress: 'dresses', sari: 'sarees' };

function buildMyntraUrl(query) {
  const q = query.toLowerCase().trim();
  if (/under\s*\d+|below\s*\d+|\d+\s*to\s*\d+/.test(q)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const BAD = new Set(['kurti', 'jean', 'ladies', 'gents', 'women', 'men']);
  if (BAD.has(q)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const corrected = SLUG_MAP[q] || q.replace(/\s+/g, '-');
  if (MYNTRA_500_SLUGS.has(corrected)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  return `https://www.myntra.com/${corrected}`;
}

async function validateMyntra(query) {
  const url = buildMyntraUrl(query);
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: { api_key: KEY, url, render: true, country_code: 'in' },
      timeout: 70000,
    });
    if (typeof html !== 'string') { console.log(`Myntra "${query}": non-string response`); return; }

    const rawProducts = extractMyntraProducts(html);
    const products = rawProducts.slice(0, 40).map(p => {
      const price = p.price || 0;
      const mrp = p.mrp || 0;
      const imageUrl = (p.searchImage || '').replace(/^http:\/\//, 'https://');
      return {
        title: cleanText(`${p.brand || ''} ${p.productName || p.product || ''}`.trim()),
        price,
        originalPrice: mrp > price ? mrp : undefined,
        imageUrl,
        platform: 'Myntra',
      };
    }).filter(isValidProduct);

    const httpLeft = products.filter(p => p.imageUrl.startsWith('http://')).length;
    const zeroPrices = products.filter(p => p.price <= 0).length;
    console.log(`Myntra "${query}" (${url.includes('search') ? 'search' : 'slug'}): ${products.length} valid / ${rawProducts.length} raw | http:// left: ${httpLeft} | price=0: ${zeroPrices}`);
    if (products.length > 0) {
      const p = products[0];
      console.log(`  ✓ Sample: "${p.title.slice(0, 50)}" ₹${p.price} img:${p.imageUrl.slice(0, 60)}`);
    }
  } catch (e) {
    console.log(`Myntra "${query}": ERROR ${e.response?.status || e.message}`);
  }
}

// ── Google Shopping validation ────────────────────────────────────────────────
async function validateGoogleShopping(query) {
  const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
    params: { api_key: KEY, query, country_code: 'in', tld: 'co.in' },
    timeout: 45000,
  });
  const SKIP = new Set(['amazon.in', 'flipkart', 'myntra']);
  const results = (data?.shopping_results || []).filter(r => {
    const s = (r.source || '').toLowerCase();
    return !Array.from(SKIP).some(p => s.includes(p));
  });

  const products = results.slice(0, 20).map(r => {
    const price = parsePrice(r.price || '0');
    const imageUrl = typeof r.thumbnail === 'string' && (r.thumbnail.startsWith('https://') || r.thumbnail.startsWith('data:')) ? r.thumbnail : '';
    return { title: cleanText(r.title || ''), price, imageUrl, platform: r.source };
  }).filter(p => p.price > 100 && p.title.length >= 8);

  const zeroPrices = products.filter(p => p.price <= 0).length;
  const noImg = products.filter(p => !p.imageUrl).length;
  console.log(`Google Shopping "${query}": ${products.length} valid | price=0: ${zeroPrices} | no img: ${noImg}`);
  if (products.length > 0) {
    const p = products[0];
    console.log(`  ✓ Sample: "${p.title.slice(0, 50)}" ₹${p.price} [${p.platform}]`);
  }

  // Verify parsePrice fixes
  const rawPrices = results.slice(0, 5).map(r => ({ raw: r.price, parsed: parsePrice(r.price || '0') }));
  console.log('  Price parsing:', rawPrices.map(x => `"${x.raw}"→${x.parsed}`).join(', '));
}

// ── Run ───────────────────────────────────────────────────────────────────────
async function main() {
  const queries = ['saree', 'kurta', 'jeans', 'dress'];
  for (const q of queries) {
    console.log(`\n${'─'.repeat(50)}\nQuery: "${q}"\n${'─'.repeat(50)}`);
    await validateAmazon(q);
    await new Promise(r => setTimeout(r, 500));
    await validateFlipkart(q);
    await new Promise(r => setTimeout(r, 500));
    await validateMyntra(q);
    await new Promise(r => setTimeout(r, 500));
    await validateGoogleShopping(q);
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('\n\n✅ VALIDATION COMPLETE');
}

main().catch(console.error);
