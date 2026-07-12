import axios from 'axios';

const WORKER = 'https://dripfeed-proxy.amitashkumarrr.workers.dev';
const q = 'saree';

async function test(name, url, parse) {
  const start = Date.now();
  try {
    const { data } = await axios.get(`${WORKER}?url=${encodeURIComponent(url)}`, { timeout: 15000 });
    const products = parse(data);
    console.log(`✅ ${name}: ${Date.now()-start}ms — ${products.length} products`);
    if (products.length > 0) console.log(`   First: ${JSON.stringify(products[0]).slice(0,120)}`);
    else console.log(`   Raw keys: ${Object.keys(data||{}).slice(0,8).join(',')} | sample: ${JSON.stringify(data).slice(0,150)}`);
  } catch(e) {
    console.log(`❌ ${name}: ${Date.now()-start}ms — ${e?.response?.status || e?.code} ${e?.message?.slice(0,60)}`);
  }
}

await test('Myntra',
  `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`,
  d => d?.products || d?.searchData?.results?.products || []
);

await test('Ajio',
  `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&format=json&sortBy=price-asc`,
  d => d?.searchresult?.products || []
);

await test('Meesho POST via GET',
  `https://www.meesho.com/api/v1/products/search?query=${encodeURIComponent(q)}&page=1&limit=20`,
  d => d?.data?.products || d?.products || []
);

await test('TataCliq',
  `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&sortBy=price-asc`,
  d => Array.isArray(d) ? d : d?.searchresult?.products || []
);

await test('Nykaa Fashion',
  `https://www.nykaafashion.com/rest/appapi/V2/search/result?q=${encodeURIComponent(q)}&page=1&pageSize=20&sortBy=price_asc`,
  d => d?.response?.products || d?.products || []
);
