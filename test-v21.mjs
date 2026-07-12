import axios from 'axios';

const start = Date.now();
console.log('Testing v21 API directly...');
try {
  const { data } = await axios.post('https://dripfeed-v21.vercel.app/api/search/product',
    { query: 'saree' },
    { timeout: 60000, headers: { 'Content-Type': 'application/json' } }
  );
  console.log(`Done in ${Date.now()-start}ms`);
  console.log('Products:', data?.products?.length ?? 0);
  console.log('Source:', data?.source);
  console.log('Query:', data?.query);
} catch(e) {
  console.log(`Failed in ${Date.now()-start}ms`);
  console.log('Status:', e?.response?.status);
  console.log('Data:', JSON.stringify(e?.response?.data));
  console.log('Message:', e?.message);
}
