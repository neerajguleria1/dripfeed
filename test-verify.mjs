import axios from 'axios';
const queries = ['jacket men', 'watch men', 'adidas shoes', 'kids shoes', 'tshirt under 500', 'sherwani men', 'yoga pants', 'sunglasses men'];
for (const q of queries) {
  try {
    const {data} = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params: {api_key: '4b561812fdd7833b798e9b1fe8163a82', query: q, country_code: 'in', tld: 'in', page: 1},
      timeout: 25000
    });
    const products = data?.results || data?.organic_results || [];
    const valid = products.filter(p => (typeof p.price === 'number' ? p.price : parseFloat(String(p.price||'0').replace(/[^0-9.]/g,''))) > 0);
    console.log(`✅ ${q} -> ${valid.length} products`);
  } catch(e) { console.log(`❌ ${q} -> FAIL ${e?.response?.status || e?.code}`); }
  await new Promise(r => setTimeout(r, 1500));
}
