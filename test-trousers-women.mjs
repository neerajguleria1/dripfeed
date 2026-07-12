import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const query = 'trousers women';
const SCRAPER_KEY = process.env.SCRAPER_API_KEY;

function parsePrice(t) {
  if (typeof t === 'number') return Math.round(t);
  const m = String(t).replace(/[₹,\s]/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}
function cleanText(t) {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}
const CATEGORY_SLUGS = new Set(['women','men','kids','ethnic','western','fashion','clothing','footwear','accessories','buy online','shop online','india']);
function isValidProduct(p) {
  const t = p.title.trim();
  if (p.price <= 0) return false;
  if (t.length < 8 || !t.includes(' ')) return false;
  if (CATEGORY_SLUGS.has(t.toLowerCase())) return false;
  if (!/[a-zA-Z]{3,}/.test(t)) return false;
  if (!p.imageUrl || !p.imageUrl.startsWith('https://')) return false;
  return true;
}

// ── Amazon ────────────────────────────────────────────────────────────────────
async function fetchAmazon() {
  const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
    params: { api_key: SCRAPER_KEY, query, country_code: 'in', tld: 'in', page: 1 },
    timeout: 25000,
  });
  const raw = data?.results || data?.organic_results || [];
  const mapped = raw.map(p => ({
    title: cleanText(p.name || p.title || ''),
    price: typeof p.price === 'number' ? p.price : parsePrice(p.price || '0'),
    imageUrl: (p.image || p.thumbnail || ''),
    platform: 'Amazon India',
  }));
  const valid = mapped.filter(isValidProduct);
  console.log(`Amazon: raw=${raw.length} valid=${valid.length} dropped=${raw.length - valid.length}`);
  const dropped = mapped.filter(p => !isValidProduct(p));
  dropped.slice(0,3).forEach(p => {
    const t = p.title.trim();
    const reasons = [];
    if (p.price <= 0) reasons.push('price=0');
    if (t.length < 8 || !t.includes(' ')) reasons.push('title too short/no space');
    if (CATEGORY_SLUGS.has(t.toLowerCase())) reasons.push('category slug');
    if (!/[a-zA-Z]{3,}/.test(t)) reasons.push('no letters');
    if (!p.imageUrl || !p.imageUrl.startsWith('https://')) reasons.push(`bad img: "${p.imageUrl?.slice(0,30)}"`);
    console.log(`  DROPPED [${reasons.join(', ')}]: "${t.slice(0,40)}"`);
  });
  return valid;
}

// ── Flipkart ──────────────────────────────────────────────────────────────────
async function fetchFlipkart() {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: SCRAPER_KEY, url: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`, render: false, country_code: 'in' },
    timeout: 20000,
  });
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
  if (!jsonMatch) { console.log('Flipkart: no __INITIAL_STATE__'); return []; }
  const state = JSON.parse(jsonMatch[1]);
  const pageData = state?.pageDataV4?.page?.data || {};
  const slots = Object.values(pageData).flat();
  const products = [];
  for (const slot of slots) { const p = slot?.widget?.data?.products; if (Array.isArray(p)) products.push(...p); }
  const mapped = products.slice(0, 20).map(p => {
    const info = p.productInfo?.value || p;
    const prices = info.pricing?.prices || [];
    const mrpEntry = prices.find(x => x.strikeOff === true);
    const spEntry = prices.find(x => x.priceType === 'SPECIAL_PRICE');
    const price = spEntry?.value || mrpEntry?.value || 0;
    const rawImg = info.media?.images?.[0]?.url || '';
    const imageUrl = rawImg.replace('{@width}','300').replace('{@height}','400').replace('{@quality}','70').replace(/^http:/,'https:');
    return { title: cleanText(info.titles?.title || info.titles?.newTitle || ''), price, imageUrl, platform: 'Flipkart' };
  });
  const valid = mapped.filter(isValidProduct);
  console.log(`Flipkart: raw=${products.length} mapped=${mapped.length} valid=${valid.length}`);
  return valid;
}

// ── Myntra ────────────────────────────────────────────────────────────────────
async function fetchMyntra() {
  const url = `https://www.myntra.com/${query.toLowerCase().replace(/\s+/g, '-')}`;
  console.log(`Myntra URL: ${url}`);
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: SCRAPER_KEY, url, render: true, country_code: 'in' },
    timeout: 65000,
  });
  const ids    = [...html.matchAll(/"productId"\s*:\s*(\d+)/g)].map(m => m[1]);
  const names  = [...html.matchAll(/"productName"\s*:\s*"([^"]+)"/g)].map(m => cleanText(m[1]));
  const brands = [...html.matchAll(/"brand"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const mrps   = [...html.matchAll(/"mrp"\s*:\s*(\d+)/g)].map(m => parseInt(m[1]));
  const discAmt= [...html.matchAll(/"discount"\s*:\s*(\d+)/g)].map(m => parseInt(m[1]));
  const images = [...html.matchAll(/"searchImage"\s*:\s*"((?:http|https):[^"]+)"/g)].map(m => m[1].replace(/\\u002F/g,'/').replace(/^http:/,'https:'));
  const count  = Math.min(ids.length, names.length, mrps.length, images.length, 40);
  const mapped = Array.from({ length: count }, (_, i) => ({
    title: `${brands[i]||''} ${names[i]||''}`.trim(),
    price: (mrps[i]||0) - (discAmt[i]||0),
    imageUrl: (images[i]||'').replace(/^http:/,'https:'),
    platform: 'Myntra',
  }));
  const valid = mapped.filter(isValidProduct);
  const dropped = mapped.filter(p => !isValidProduct(p));
  console.log(`Myntra: ids=${ids.length} count=${count} valid=${valid.length} dropped=${dropped.length}`);
  dropped.slice(0,3).forEach(p => {
    const t = p.title.trim();
    const reasons = [];
    if (p.price <= 0) reasons.push('price=0');
    if (t.length < 8 || !t.includes(' ')) reasons.push('title short/no space');
    if (!p.imageUrl.startsWith('https://')) reasons.push(`bad img: "${p.imageUrl.slice(0,30)}"`);
    console.log(`  DROPPED [${reasons.join(', ')}]: "${t.slice(0,40)}"`);
  });
  return valid;
}

// ── Google Shopping ───────────────────────────────────────────────────────────
async function fetchGoogleShopping() {
  const SKIP = ['amazon.in', 'flipkart', 'myntra'];
  const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
    params: { api_key: SCRAPER_KEY, query, country_code: 'in', tld: 'co.in' },
    timeout: 45000,
  });
  const all = data?.shopping_results || [];
  const filtered = all.filter(r => !SKIP.some(p => (r.source||'').toLowerCase().includes(p)));
  const mapped = filtered.slice(0,20).map((r,i) => ({
    title: cleanText(r.title||''),
    price: parsePrice(r.price||'0'),
    imageUrl: typeof r.thumbnail === 'string' && (r.thumbnail.startsWith('https://') || r.thumbnail.startsWith('data:')) ? r.thumbnail : '',
    platform: r.source,
    url: r.link||'',
  }));
  const valid = mapped.filter(p => p.price > 100 && p.title.length >= 8 && p.title.includes(' ') && p.url);
  console.log(`Google Shopping: all=${all.length} filtered=${filtered.length} valid=${valid.length}`);
  // Check if imageUrl is causing isValidProduct to drop them
  const droppedByImg = mapped.filter(p => p.price > 100 && p.title.length >= 8 && p.title.includes(' ') && p.url && !p.imageUrl.startsWith('https://'));
  if (droppedByImg.length) console.log(`  NOTE: ${droppedByImg.length} GS results have non-https images (base64/empty)`);
  return valid;
}

console.log(`\nQuery: "${query}"\n`);
const [az, fk, mn, gs] = await Promise.all([
  fetchAmazon().catch(e => { console.log('Amazon error:', e.message?.slice(0,60)); return []; }),
  fetchFlipkart().catch(e => { console.log('Flipkart error:', e.message?.slice(0,60)); return []; }),
  fetchMyntra().catch(e => { console.log('Myntra error:', e.message?.slice(0,60)); return []; }),
  fetchGoogleShopping().catch(e => { console.log('GS error:', e.message?.slice(0,60)); return []; }),
]);

// Simulate final isValidProduct pass (same as searchProducts)
const all = [...az, ...fk, ...mn, ...gs].filter(isValidProduct);
console.log(`\n═══ Final after isValidProduct ═══`);
console.log(`Amazon:${az.length} Flipkart:${fk.length} Myntra:${mn.length} GS:${gs.length} → Total:${all.length}`);
