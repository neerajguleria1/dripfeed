import axios from 'axios';
const q = 'saree';

// Simulate exactly what fetchMyntra does
const homeResp = await axios.get('https://www.myntra.com/', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
  },
  timeout: 10000,
  maxRedirects: 5,
});
const raw = homeResp.headers['set-cookie'] || [];
const cookies = raw.map(c => c.split(';')[0]).join('; ');
console.log('Cookies obtained:', cookies.slice(0, 80) + '...');

const { data } = await axios.get(
  `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`,
  {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Referer': 'https://www.myntra.com/',
      'Cookie': cookies,
      'x-myntraweb': 'Yes',
      'x-location-code': 'MH',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
    },
    timeout: 15000,
  }
);

const products = data?.products || [];
console.log(`✅ Myntra: ${products.length} products`);
console.log('Sample:', products.slice(0,3).map(p => `${p.brand} ${p.productName} ₹${p.price}`).join('\n'));
