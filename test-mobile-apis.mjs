import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';
const q = 'saree';

async function time(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`✅ ${name}: ${Date.now()-start}ms — ${result}`);
  } catch(e) {
    console.log(`❌ ${name}: ${Date.now()-start}ms — ${e?.response?.status || e?.code} | ${e?.message?.slice(0,60)}`);
  }
}

// Myntra mobile API
await time('Myntra mobile v1', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`, render: false, country_code: 'in' },
    headers: { 'x-myntraweb': 'Yes', 'x-location-code': 'MH', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Mobile Safari/537.36' },
    timeout: 15000
  });
  const p = data?.products || data?.searchData?.results?.products || [];
  return `${p.length} products | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`;
});

await time('Myntra mobile v3', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.myntra.com/gateway/v3/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false`, render: false, country_code: 'in' },
    timeout: 15000
  });
  const p = data?.products || data?.searchData?.results?.products || [];
  return `${p.length} products | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`;
});

// Meesho mobile/internal API
await time('Meesho catalog v2', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.meesho.com/api/v2/products/search?q=${encodeURIComponent(q)}&page=1&limit=20`, render: false, country_code: 'in' },
    timeout: 15000
  });
  const p = data?.data?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`;
});

await time('Meesho supply v1', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.meesho.com/api/v1/supply/search?q=${encodeURIComponent(q)}&page=1&limit=20&sort=price_asc`, render: false, country_code: 'in' },
    timeout: 15000
  });
  const p = data?.data?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`;
});

// Ajio mobile API
await time('Ajio mobile search', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&format=json&sortBy=price-asc&lang=en&curr=INR`, render: false, country_code: 'in' },
    headers: { 'User-Agent': 'AJIO/5.0 (Android)', 'x-api-client': 'ajio-android' },
    timeout: 15000
  });
  const p = data?.searchresult?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data||{}).slice(0,8).join(',')}`;
});

await time('Ajio catalog API', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.ajio.com/api/category/830?text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&format=json`, render: false, country_code: 'in' },
    timeout: 15000
  });
  const p = data?.searchresult?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data||{}).slice(0,8).join(',')}`;
});

// TataCliq correct endpoint
await time('TataCliq search v2', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&sortBy=price-asc&inStockOnly=false`, render: false, country_code: 'in' },
    timeout: 15000
  });
  // TataCliq returns array directly
  const p = Array.isArray(data) ? data : data?.searchresult?.products || data?.products || [];
  const sample = Array.isArray(data) && data[0] ? JSON.stringify(data[0]).slice(0,100) : JSON.stringify(data).slice(0,100);
  return `${Array.isArray(p) ? p.length : 'not array'} | sample: ${sample}`;
});

await time('TataCliq graphql', async () => {
  const { data } = await axios.post('https://api.scraperapi.com/', 
    JSON.stringify({ query: `{search(text:"${q}",pageSize:20,currentPage:0,sortBy:"price-asc"){products{name price{value}image{url}}}}` }),
    {
      params: { api_key: key, url: 'https://www.tatacliq.com/graphql', render: false, country_code: 'in' },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );
  const p = data?.data?.search?.products || [];
  return `${p.length} products | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`;
});

// Nykaa Fashion mobile
await time('Nykaa Fashion mobile', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.nykaafashion.com/rest/appapi/V2/search/result?q=${encodeURIComponent(q)}&page=1&pageSize=20&sortBy=price_asc&channel=web`, render: false, country_code: 'in' },
    headers: { 'X-Channel': 'web', 'X-Nykaa-App-Version': '5.0' },
    timeout: 15000
  });
  const p = data?.response?.products || data?.products || [];
  return `${Array.isArray(p) ? p.length : 'not array'} | keys: ${Object.keys(data?.response||data||{}).slice(0,6).join(',')}`;
});

// Snapdeal correct endpoint
await time('Snapdeal search', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.snapdeal.com/acors/json/product/get/search/v5?q=${encodeURIComponent(q)}&sort=rlvncy&start=0&rows=20&lang=en`, render: false, country_code: 'in' },
    timeout: 15000
  });
  const p = data?.products || [];
  return `${p.length} products | first: ${p[0]?.title?.slice(0,40)}`;
});
