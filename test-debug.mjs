import axios from 'axios';

console.log('Hitting v21 debug endpoint...');
try {
  const { data } = await axios.get('https://dripfeed-v21.vercel.app/api/debug/search?q=saree', { timeout: 60000 });
  console.log(JSON.stringify(data, null, 2));
} catch(e) {
  console.log('Error:', e?.response?.status, JSON.stringify(e?.response?.data));
}
