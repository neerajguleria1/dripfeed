// test-myntra-sample.mjs — 20 representative queries, render:true = 25 credits each = 500 credits
import axios from 'axios';

const SCRAPER_KEY = '62dab316fd542f8324cfcd3c396e0674';

const SAMPLE = [
  // footwear (slug-based)
  'sneakers', 'sports shoes', 'casual shoes', 'sandals', 'heels',
  // clothing (search-based due to 500 slugs)
  'jeans men', 'jeans women', 'dress women', 'tops women', 'saree',
  // ethnic
  'kurta men', 'kurti women', 'lehenga', 'salwar suit', 'sherwani men',
  // brand
  'adidas shoes', 'puma shoes',
  // price intent
  'shoes under 1000', 'tshirt under 500',
  // typo
  'jaket men',
];

const MYNTRA_500_SLUGS = new Set([
  'sarees','jeans','dresses','leggings','skirts','tops','blazers',
  'hoodies','pants','shorts','suits','coats','bags','watches',
]);
const SLUG_MAP = {
  saree:'sarees',kurta:'kurtas',jean:'jeans',trouser:'trousers',
  legging:'leggings',dress:'dresses',skirt:'skirts',top:'tops',
  shoe:'footwear',sandal:'sandals',sneaker:'sneakers',boot:'boots',
  jacket:'jackets',blazer:'blazers',hoodie:'hoodies',shirt:'shirts',
  pant:'pants',short:'shorts',suit:'suits',coat:'coats',
  bag:'bags',watch:'watches',sari:'sarees',
};
function buildMyntraUrl(query) {
  const q = query.toLowerCase().trim();
  if (/under\s*\d+|below\s*\d+|\d+\s*to\s*\d+/.test(q)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const BAD = new Set(['kurti','jean','kurtas','ladies','gents','women','men']);
  if (BAD.has(q)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const BRANDS = new Set(['levis','zara','h&m','hm','puma','adidas','reebok','gap','mango']);
  const words = q.split(' ');
  if (words.length >= 2 && BRANDS.has(words[0])) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  const corrected = SLUG_MAP[q] || q.replace(/\s+/g,'-');
  if (MYNTRA_500_SLUGS.has(corrected)) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  return `https://www.myntra.com/${corrected}`;
}

console.log(`\n🔍 Testing ${SAMPLE.length} queries on MYNTRA (render:true, ~25 credits each)\n`);
console.log('─'.repeat(70));

let passed = 0, failed = 0;
for (const query of SAMPLE) {
  const url = buildMyntraUrl(query);
  const urlShort = url.replace('https://www.myntra.com','myntra.com');
  try {
    const {data: html} = await axios.get('https://api.scraperapi.com/', {
      params: {api_key: SCRAPER_KEY, url, render: true, country_code: 'in'},
      timeout: 65000,
    });
    if (typeof html !== 'string') { console.log(`❌ [${query.padEnd(25)}] NOT_STRING → ${urlShort}`); failed++; continue; }
    const startIdx = html.indexOf('"products":[{');
    if (startIdx < 0) { console.log(`❌ [${query.padEnd(25)}] NO_PRODUCTS → ${urlShort}`); failed++; continue; }
    // count products
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
    console.log(`✅ [${query.padEnd(25)}] ${count} products → ${urlShort}`);
    passed++;
  } catch(e) {
    console.log(`❌ [${query.padEnd(25)}] ${e?.response?.status || e?.code} → ${urlShort}`);
    failed++;
  }
  await new Promise(r => setTimeout(r, 500));
}

console.log('\n' + '─'.repeat(70));
console.log(`\n📊 ${passed}/${SAMPLE.length} passed, ${failed} failed\n`);
