import axios from 'axios';

const KEY = '4b561812fdd7833b798e9b1fe8163a82';

async function main() {
  const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
    params: { api_key: KEY, query: 'saree women ajio', country_code: 'in', tld: 'co.in' },
    timeout: 45000,
  });
  const results = data?.shopping_results || [];
  console.log('Total:', results.length);
  console.log('\nAll keys on first result:', Object.keys(results[0] || {}).join(', '));
  
  // Show all fields for first 3 results
  for (const r of results.slice(0, 5)) {
    console.log('\n---');
    console.log('title:', r.title);
    console.log('source:', r.source);
    console.log('price:', r.price);
    console.log('extracted_price:', r.extracted_price);
    console.log('link:', r.link?.slice(0, 100));
    console.log('product_link:', r.product_link?.slice(0, 100));
    console.log('merchant_link:', r.merchant_link?.slice(0, 100));
    console.log('All keys:', Object.keys(r).join(', '));
  }
  
  // Check extracted_price vs parsePrice(price)
  console.log('\n=== PRICE COMPARISON ===');
  for (const r of results.slice(0, 10)) {
    const extracted = r.extracted_price || 0;
    const parsed = r.price ? parseInt(r.price.replace(/[₹,\s]/g, '')) : 0;
    const match = extracted === parsed ? '✓' : '✗';
    console.log(`${match} extracted=${extracted} parsed=${parsed} raw="${r.price}"`);
  }
}

main().catch(console.error);
