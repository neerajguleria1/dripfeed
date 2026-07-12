import axios from 'axios';
const q = 'saree';

async function test(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`✅ ${name}: ${Date.now()-start}ms — ${result}`);
  } catch(e) {
    console.log(`❌ ${name}: ${Date.now()-start}ms — ${e?.response?.status || e?.code} | ${e?.message?.slice(0,60)}`);
  }
}

// ── MYNTRA ──────────────────────────────────────────────────────────────────

// Myntra has a public sitemap/feed — no auth needed
await test('Myntra sitemap', async () => {
  const { data } = await axios.get('https://www.myntra.com/sitemap.xml', { timeout: 10000 });
  return `${typeof data} len=${data?.length}`;
});

// Myntra app API — used by their Android app, different endpoint
await test('Myntra app search', async () => {
  const { data } = await axios.get(
    `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false`,
    {
      headers: {
        'User-Agent': 'Myntra/5.0.0 (Android; 13)',
        'x-myntraweb': 'Yes',
        'x-meta-app': '{"appFamily":"MyntraRetailApp","appVersion":"5.0.0"}',
        'x-location-code': 'MH',
        'Accept': 'application/json',
      },
      timeout: 10000
    }
  );
  const p = data?.products || [];
  return `${p.length} products | keys: ${Object.keys(data||{}).slice(0,5).join(',')}`;
});

// Myntra public product listing — no JS needed
await test('Myntra listing page', async () => {
  const { data } = await axios.get(
    `https://www.myntra.com/sarees`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
      },
      timeout: 10000
    }
  );
  const hasProducts = typeof data === 'string' && data.includes('"productId"');
  return `html=${typeof data === 'string' ? data.length : 'not string'} hasProducts=${hasProducts}`;
});

// ── AJIO ────────────────────────────────────────────────────────────────────

// Ajio has a public GraphQL endpoint
await test('Ajio GraphQL', async () => {
  const { data } = await axios.post(
    'https://www.ajio.com/api/search',
    null,
    {
      params: { text: q, pageSize: 5, currentPage: 0, format: 'json' },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'application/json',
        'x-requested-with': 'XMLHttpRequest',
      },
      timeout: 10000
    }
  );
  const p = data?.searchresult?.products || [];
  return `${p.length} products | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`;
});

// Ajio with Googlebot UA — many sites whitelist crawlers
await test('Ajio Googlebot', async () => {
  const { data } = await axios.get(
    `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=5&currentPage=0&format=json`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/json',
      },
      timeout: 10000
    }
  );
  const p = data?.searchresult?.products || [];
  return `${p.length} products | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`;
});

// Ajio RSS/sitemap
await test('Ajio sitemap', async () => {
  const { data } = await axios.get('https://www.ajio.com/sitemap.xml', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    timeout: 10000
  });
  return `${typeof data} len=${typeof data === 'string' ? data.length : JSON.stringify(data).length}`;
});

// ── MEESHO ──────────────────────────────────────────────────────────────────

// Meesho has a public catalog API used by affiliates
await test('Meesho affiliate API', async () => {
  const { data } = await axios.get(
    `https://www.meesho.com/api/v1/catalog/search?q=${encodeURIComponent(q)}&page=1&limit=20`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'application/json',
      },
      timeout: 10000
    }
  );
  const p = data?.data?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`;
});

// Meesho public share links have product data
await test('Meesho share API', async () => {
  const { data } = await axios.get(
    `https://www.meesho.com/api/v1/products?q=${encodeURIComponent(q)}&page=1&limit=20&sort=price_asc`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000
    }
  );
  return `keys: ${Object.keys(data||{}).slice(0,6).join(',')} | sample: ${JSON.stringify(data).slice(0,100)}`;
});

// ── TATACLIQ ────────────────────────────────────────────────────────────────

// TataCliq has a public search API
await test('TataCliq search API', async () => {
  const { data } = await axios.get(
    `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(q)}&pageSize=20&currentPage=0`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'application/json',
        'x-channel': 'WEB',
      },
      timeout: 10000
    }
  );
  const p = data?.searchresult?.products || [];
  return `${p.length} products | type=${typeof data} | sample: ${JSON.stringify(data).slice(0,100)}`;
});

// TataCliq Solr endpoint
await test('TataCliq Solr', async () => {
  const { data } = await axios.get(
    `https://www.tatacliq.com/api/v3/search/?searchCategory=all&text=${encodeURIComponent(q)}&pageSize=20&currentPage=0`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000
    }
  );
  const p = data?.searchresult?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : typeof data} | sample: ${JSON.stringify(data).slice(0,100)}`;
});

// ── NYKAA ───────────────────────────────────────────────────────────────────

await test('Nykaa Fashion search', async () => {
  const { data } = await axios.get(
    `https://www.nykaafashion.com/rest/appapi/V2/search/result?q=${encodeURIComponent(q)}&page=1&pageSize=20`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 10000
    }
  );
  const p = data?.response?.products || [];
  return `${p.length} products | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`;
});

// Nykaa v3 API
await test('Nykaa v3', async () => {
  const { data } = await axios.get(
    `https://www.nykaa.com/sp-api/search/results?q=${encodeURIComponent(q)}&type=product&page=1&ptype=fashion&sortBy=price_asc`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000
    }
  );
  return `keys: ${Object.keys(data||{}).slice(0,6).join(',')} | sample: ${JSON.stringify(data).slice(0,100)}`;
});
