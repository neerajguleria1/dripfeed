import axios from 'axios';
const q = 'saree';

const homeResp = await axios.get('https://www.myntra.com/', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-IN,en;q=0.9',
  },
  timeout: 10000,
});
const cookies = homeResp.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';

const { data } = await axios.get(
  `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(q)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`,
  {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Referer': 'https://www.myntra.com/',
      'Cookie': cookies,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
    },
    timeout: 10000,
  }
);

console.log('Top keys:', Object.keys(data));
console.log('Products count:', data?.products?.length);
console.log('First product full:', JSON.stringify(data?.products?.[0], null, 2));
