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
  } else { normalized = s.replace(/,/g, ''); }
  const m = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

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

async function testMyntraUrl(label, url) {
  console.log(`\n--- Myntra: ${label} ---`);
  console.log(`    URL: ${url}`);
  try {
    const { data: html, status } = await axios.get('https://api.scraperapi.com/', {
      params: { api_key: KEY, url, render: true, country_code: 'in' },
      timeout: 70000,
    });
    const raw = extractMyntraProducts(html);
    const products = raw.map(p => ({
      title: `${p.brand || ''} ${p.productName || p.product || ''}`.trim(),
      price: p.price || 0,
      category: p.category || p.masterCategory?.typeName || '',
      articleType: p.articleType?.typeName || '',
    })).filter(p => p.price > 0);

    console.log(`    Status: ${status}, products: ${products.length}`);
    // Show article types to detect wrong category
    const types = [...new Set(products.map(p => p.articleType))].join(', ');
    console.log(`    Article types: ${types}`);
    const prices = products.map(p => p.price).sort((a,b) => a-b);
    if (prices.length) console.log(`    Price range: ₹${prices[0]} – ₹${prices[prices.length-1]}`);
    for (const p of products.slice(0, 3)) {
      console.log(`    ₹${p.price} [${p.articleType}] ${p.title.slice(0, 55)}`);
    }
  } catch(e) { console.log(`    ERROR: ${e.response?.status || e.message}`); }
  await new Promise(r => setTimeout(r, 2500));
}

// Test Amazon with price_asc sort
async function testAmazonSort(query) {
  console.log(`\n=== AMAZON sort test: "${query}" ===`);
  try {
    // ScraperAPI structured endpoint doesn't support sort — test raw HTML with sort
    const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params: { api_key: KEY, query: `${query} india`, country_code: 'in', tld: 'in', page: 1, sort_by: 'price_asc' },
      timeout: 30000,
    });
    const raw = data?.results || data?.organic_results || [];
    const products = raw.map(p => ({
      title: (p.name || p.title || '').slice(0, 50),
      price: typeof p.price === 'number' ? p.price : parsePrice(p.price || '0'),
    })).filter(p => p.price > 0);
    const prices = products.map(p => p.price).sort((a,b) => a-b);
    console.log(`  Products: ${products.length}, range: ₹${prices[0]} – ₹${prices[prices.length-1]}`);
    console.log(`  Under ₹500: ${products.filter(p => p.price < 500).length}`);
    console.log(`  First 5 (as returned):`, products.slice(0, 5).map(p => `₹${p.price}`).join(', '));
    console.log(`  Cheapest 5:`, prices.slice(0, 5).map(p => `₹${p}`).join(', '));
  } catch(e) { console.log('  ERROR:', e.message); }
}

// Test what Myntra category pages work for footwear
async function main() {
  // Test various Myntra footwear URLs
  await testMyntraUrl('footwear slug', 'https://www.myntra.com/footwear');
  await testMyntraUrl('sports-shoes slug', 'https://www.myntra.com/sports-shoes');
  await testMyntraUrl('casual-shoes slug', 'https://www.myntra.com/casual-shoes');
  await testMyntraUrl('sneakers slug', 'https://www.myntra.com/sneakers');
  await testMyntraUrl('search?q=shoes&sort=price_asc', 'https://www.myntra.com/search?q=shoes&sort=price_asc');
  await testMyntraUrl('footwear?sort=price_asc', 'https://www.myntra.com/footwear?sort=price_asc');
  
  await testAmazonSort('shoes');
  
  console.log('\nDONE');
}
main().catch(console.error);
