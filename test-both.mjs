import axios from 'axios';

// Test both URLs
for (const base of ['https://dripfeed-v21.vercel.app', 'https://dripfeed-snowy.vercel.app']) {
  console.log(`\nTesting ${base}...`);
  try {
    const { data } = await axios.post(`${base}/api/search/product`,
      { query: 'saree' },
      { timeout: 60000 }
    );
    console.log('Products:', data?.products?.length ?? 0, '| source:', data?.source);
  } catch(e) {
    console.log('Error:', e?.response?.status, e?.response?.data || e?.message);
  }
}
