import axios from 'axios';

// Fetch ScraperAPI pricing/credit docs
try {
  const {data} = await axios.get('https://docs.scraperapi.com/making-requests/credit-cost', {
    timeout: 10000,
    headers: {'User-Agent': 'Mozilla/5.0'}
  });
  // Extract relevant text
  const text = data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const idx = text.indexOf('credit');
  console.log(text.slice(Math.max(0, idx-200), idx+2000));
} catch(e) {
  console.log('Failed:', e?.message);
}
