import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';

async function time(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`✅ ${name}: ${Date.now()-start}ms — ${result}`);
  } catch(e) {
    console.log(`❌ ${name}: ${Date.now()-start}ms — ${e?.response?.status || e?.code} ${e?.message?.slice(0,80)}`);
  }
}

const q = 'saree';

// Myntra — render:true (JS heavy)
await time('Myntra (render:true)', async () => {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.myntra.com/search?q=${q}`, render: true, country_code: 'in' },
    timeout: 70000
  });
  const has = typeof html === 'string' && html.includes('"products":[{');
  return `html=${typeof html === 'string' ? html.length : 'not string'} has_products=${has}`;
});

// Myntra API — render:false JSON endpoint
await time('Myntra API (render:false)', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false`, render: false, country_code: 'in' },
    timeout: 20000
  });
  const products = data?.products || data?.searchData?.results?.products || [];
  return `${products.length} products, first: ${products[0]?.productName || JSON.stringify(data)?.slice(0,60)}`;
});

// Meesho
await time('Meesho', async () => {
  const { data } = await axios.post('https://api.scraperapi.com/', 
    JSON.stringify({ query: q, page: 1, limit: 20, filters: {}, sort: 'price_asc' }),
    {
      params: { api_key: key, url: 'https://www.meesho.com/api/v1/products/search', render: false },
      headers: { 'Content-Type': 'application/json', 'x-meesho-client': 'meesho-web' },
      timeout: 20000
    }
  );
  const products = data?.data?.products || data?.products || [];
  return `${products.length} products, first: ${products[0]?.name?.slice(0,40)}`;
});

// Ajio
await time('Ajio', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&format=json&sortBy=price-asc`, render: false, country_code: 'in' },
    timeout: 20000
  });
  const products = data?.searchresult?.products || data?.products || [];
  return `${products.length} products, first: ${products[0]?.name?.slice(0,40)}`;
});

// TataCliq
await time('TataCliq', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&sortBy=price-asc`, render: false, country_code: 'in' },
    timeout: 20000
  });
  const products = data?.searchresult?.products || data?.products || [];
  return `${products.length} products, first: ${products[0]?.name?.slice(0,40)}`;
});

// Nykaa Fashion
await time('Nykaa Fashion', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.nykaafashion.com/rest/appapi/V2/search/result?q=${encodeURIComponent(q)}&page=1&pageSize=20&sortBy=price_asc`, render: false, country_code: 'in' },
    timeout: 20000
  });
  const products = data?.response?.products || data?.products || [];
  return `${products.length} products, first: ${products[0]?.name?.slice(0,40)}`;
});

// Snapdeal
await time('Snapdeal', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.snapdeal.com/acors/json/product/get/search/v5?q=${encodeURIComponent(q)}&sort=rlvncy&start=0&rows=20`, render: false, country_code: 'in' },
    timeout: 20000
  });
  const products = data?.products || [];
  return `${products.length} products, first: ${products[0]?.title?.slice(0,40)}`;
});

// Bewakoof
await time('Bewakoof', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.bewakoof.com/api/catalog/search?q=${encodeURIComponent(q)}&page=1&limit=20`, render: false, country_code: 'in' },
    timeout: 20000
  });
  const products = data?.data?.products || data?.products || [];
  return `${products.length} products, first: ${products[0]?.name?.slice(0,40)}`;
});
