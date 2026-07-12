import axios from 'axios';
const base = 'https://dripfeed-v21.vercel.app/api/proxy?url=';
const q = 'saree';

const { data } = await axios.get(`${base}${encodeURIComponent(`https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`)}`, { timeout: 30000 });
console.log('Keys:', Object.keys(data || {}));
console.log('Full:', JSON.stringify(data).slice(0, 600));
