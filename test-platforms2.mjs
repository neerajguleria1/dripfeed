import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';
const q = 'saree';

async function time(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`✅ ${name}: ${Date.now()-start}ms — ${result}`);
  } catch(e) {
    console.log(`❌ ${name}: ${Date.now()-start}ms — ${e?.response?.status || e?.code} ${e?.message?.slice(0,80)}`);
  }
}

// Ajio — check what the response actually looks like
await time('Ajio raw keys', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=5&currentPage=0&format=json`, render: false, country_code: 'in' },
    timeout: 20000
  });
  return `keys=${Object.keys(data||{}).join(',')} | sample=${JSON.stringify(data)?.slice(0,120)}`;
});

// TataCliq — check raw response
await time('TataCliq raw keys', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(q)}&pageSize=5&currentPage=0`, render: false, country_code: 'in' },
    timeout: 20000
  });
  return `keys=${Object.keys(data||{}).join(',')} | sample=${JSON.stringify(data)?.slice(0,120)}`;
});

// Meesho with render:true
await time('Meesho render:true', async () => {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.meesho.com/search?q=${encodeURIComponent(q)}`, render: true, country_code: 'in' },
    timeout: 70000
  });
  const has = typeof html === 'string' && (html.includes('productName') || html.includes('product_name') || html.includes('"name"'));
  return `html=${typeof html === 'string' ? html.length : 'not string'} has_products=${has} sample=${typeof html === 'string' ? html.slice(0,100) : ''}`;
});

// Flipkart structured API (ScraperAPI has one)
await time('Flipkart structured', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/structured/flipkart/search', {
    params: { api_key: key, query: q },
    timeout: 20000
  });
  return `keys=${Object.keys(data||{}).join(',')} | sample=${JSON.stringify(data)?.slice(0,120)}`;
});

// Nykaa Fashion different endpoint
await time('Nykaa v1', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.nykaa.com/sp-api/search/results?q=${encodeURIComponent(q)}&type=product&page=1&ptype=fashion`, render: false, country_code: 'in' },
    timeout: 20000
  });
  const products = data?.response?.products || data?.products || data?.data || [];
  return `${Array.isArray(products) ? products.length : 'not array'} | keys=${Object.keys(data||{}).join(',')}`;
});
