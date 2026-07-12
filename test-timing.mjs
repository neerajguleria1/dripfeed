import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';

async function time(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`${name}: ${Date.now()-start}ms — ${result} results`);
  } catch(e) {
    console.log(`${name}: ${Date.now()-start}ms — ERROR ${e?.response?.status || e?.code} ${e?.message?.slice(0,60)}`);
  }
}

await time('Amazon', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
    params: { api_key: key, query: 'saree', country_code: 'in', tld: 'in', page: 1 },
    timeout: 15000
  });
  return data?.results?.length ?? 0;
});

await time('Google', async () => {
  const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
    params: { api_key: key, query: 'saree', country_code: 'in', tld: 'co.in' },
    timeout: 15000
  });
  return data?.shopping_results?.length ?? 0;
});

await time('Flipkart', async () => {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: 'https://www.flipkart.com/search?q=saree&sort=price_asc', render: false, country_code: 'in' },
    timeout: 15000
  });
  return typeof html === 'string' ? html.length + ' chars' : 'not string';
});
