import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';

console.log('Testing Amazon saree...');
try {
  const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
    params: { api_key: key, query: 'saree', country_code: 'in', tld: 'in', page: 1 },
    timeout: 25000
  });
  console.log('Amazon results:', data?.results?.length ?? 0, '| status ok');
} catch(e) { console.log('Amazon error:', e?.response?.status, e?.message); }

console.log('Testing Google saree...');
try {
  const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
    params: { api_key: key, query: 'saree', country_code: 'in', tld: 'co.in' },
    timeout: 45000
  });
  console.log('Google results:', data?.shopping_results?.length ?? 0, '| status ok');
} catch(e) { console.log('Google error:', e?.response?.status, e?.message); }

console.log('Testing Flipkart saree...');
try {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: 'https://www.flipkart.com/search?q=saree&sort=price_asc', render: false, country_code: 'in' },
    timeout: 20000
  });
  const hasState = typeof html === 'string' && html.includes('__INITIAL_STATE__');
  console.log('Flipkart html length:', typeof html === 'string' ? html.length : 'not string', '| has __INITIAL_STATE__:', hasState);
} catch(e) { console.log('Flipkart error:', e?.response?.status, e?.message); }
