import axios from 'axios';
const q = 'saree';

async function time(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`✅ ${name}: ${Date.now()-start}ms — ${result}`);
  } catch(e) {
    console.log(`❌ ${name}: ${Date.now()-start}ms — ${e?.response?.status || e?.code} | ${e?.message?.slice(0,80)}`);
  }
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.myntra.com/',
  'Origin': 'https://www.myntra.com',
};

// Myntra gateway API — direct
await time('Myntra gateway direct', async () => {
  const { data } = await axios.get(
    `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`,
    { headers: { ...BROWSER_HEADERS, 'x-myntraweb': 'Yes', 'x-location-code': 'MH' }, timeout: 10000 }
  );
  const p = data?.products || data?.searchData?.results?.products || [];
  return `${p.length} products | first: ${p[0]?.productName?.slice(0,40)}`;
});

// Meesho catalog API — direct
await time('Meesho catalog direct', async () => {
  const { data } = await axios.post(
    'https://www.meesho.com/api/v1/products/search',
    { query: q, page: 1, limit: 20, filters: {}, sort: 'price_asc' },
    { headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.meesho.com/', 'Origin': 'https://www.meesho.com', 'x-meesho-client': 'meesho-web' }, timeout: 10000 }
  );
  const p = data?.data?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data||{}).slice(0,5).join(',')}`;
});

// Ajio search API — direct
await time('Ajio search direct', async () => {
  const { data } = await axios.get(
    `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&format=json&sortBy=price-asc`,
    { headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.ajio.com/', 'Origin': 'https://www.ajio.com' }, timeout: 10000 }
  );
  const p = data?.searchresult?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data||{}).slice(0,8).join(',')}`;
});

// TataCliq API — direct
await time('TataCliq direct', async () => {
  const { data } = await axios.get(
    `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&sortBy=price-asc`,
    { headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.tatacliq.com/', 'Origin': 'https://www.tatacliq.com' }, timeout: 10000 }
  );
  const p = data?.searchresult?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data||{}).slice(0,8).join(',')}`;
});

// Nykaa Fashion — direct
await time('Nykaa Fashion direct', async () => {
  const { data } = await axios.get(
    `https://www.nykaafashion.com/rest/appapi/V2/search/result?q=${encodeURIComponent(q)}&page=1&pageSize=20&sortBy=price_asc`,
    { headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.nykaafashion.com/', 'Origin': 'https://www.nykaafashion.com' }, timeout: 10000 }
  );
  const p = data?.response?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data?.response||data||{}).slice(0,6).join(',')}`;
});
