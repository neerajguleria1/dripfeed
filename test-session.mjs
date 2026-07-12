import axios from 'axios';
const q = 'saree';

// Strategy: hit homepage first to get cookies, then use them for API
async function testWithSession(name, homeUrl, apiUrl, parse) {
  const start = Date.now();
  try {
    // Step 1: get homepage cookies
    const homeResp = await axios.get(homeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: 10000,
      maxRedirects: 5,
    });
    const cookies = homeResp.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
    console.log(`  ${name} cookies: ${cookies.slice(0, 100)}`);

    // Step 2: use cookies for API call
    const { data } = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Referer': homeUrl,
        'Cookie': cookies,
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
      },
      timeout: 10000,
    });
    const products = parse(data);
    console.log(`✅ ${name}: ${Date.now()-start}ms — ${products.length} products`);
    if (products.length > 0) console.log(`   First: ${JSON.stringify(products[0]).slice(0,120)}`);
    else console.log(`   Keys: ${Object.keys(data||{}).slice(0,8)} | sample: ${JSON.stringify(data).slice(0,150)}`);
  } catch(e) {
    console.log(`❌ ${name}: ${Date.now()-start}ms — ${e?.response?.status || e?.code} ${e?.message?.slice(0,60)}`);
  }
}

await testWithSession(
  'Myntra',
  'https://www.myntra.com/',
  `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`,
  d => d?.products || []
);

await testWithSession(
  'Ajio',
  'https://www.ajio.com/',
  `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&format=json&sortBy=price-asc`,
  d => d?.searchresult?.products || []
);

await testWithSession(
  'Meesho',
  'https://www.meesho.com/',
  `https://www.meesho.com/api/v1/products/search?query=${encodeURIComponent(q)}&page=1&limit=20`,
  d => d?.data?.products || d?.products || []
);

// TataCliq — try their actual XHR endpoint with session
await testWithSession(
  'TataCliq',
  'https://www.tatacliq.com/',
  `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&sortBy=price-asc&inStockOnly=false&channel=WEB`,
  d => {
    if (typeof d === 'string') return [];
    return d?.searchresult?.products || d?.products || [];
  }
);
