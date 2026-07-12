import axios from 'axios';
const base = 'https://dripfeed-v21.vercel.app/api/proxy?url=';
const q = 'saree';

async function time(name, url) {
  const start = Date.now();
  try {
    const { data } = await axios.get(`${base}${encodeURIComponent(url)}`, { timeout: 30000 });
    const p = data?.products || data?.searchresult?.products || data?.searchData?.results?.products || [];
    console.log(`✅ ${name}: ${Date.now()-start}ms — ${Array.isArray(p) ? p.length : 'not array'} products | keys: ${Object.keys(data||{}).slice(0,6).join(',')}`);
    if (Array.isArray(p) && p.length > 0) console.log('   First:', JSON.stringify(p[0]).slice(0,120));
  } catch(e) {
    console.log(`❌ ${name}: ${Date.now()-start}ms — ${e?.response?.status} ${e?.message?.slice(0,60)}`);
  }
}

await time('Myntra', `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`);
await time('Ajio', `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=20&currentPage=0&format=json&sortBy=price-asc`);
await time('Meesho', `https://www.meesho.com/api/v1/products/search`);
