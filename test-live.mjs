import axios from 'axios';

console.log('Testing live Vercel API...');
try {
  const { data } = await axios.post('https://dripfeed-v21.vercel.app/api/search/product', 
    { query: 'saree' },
    { timeout: 60000 }
  );
  console.log('Status: ok');
  console.log('Products count:', data?.products?.length ?? 0);
  console.log('Source:', data?.source);
  if (data?.products?.length > 0) {
    console.log('First product:', JSON.stringify(data.products[0], null, 2));
  } else {
    console.log('Full response:', JSON.stringify(data, null, 2));
  }
} catch(e) {
  console.log('Error status:', e?.response?.status);
  console.log('Error data:', JSON.stringify(e?.response?.data, null, 2));
  console.log('Error message:', e?.message);
}
