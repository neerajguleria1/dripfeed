import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';
const q = 'saree';

// Ajio — print full response structure
console.log('=== Ajio catalog API ===');
try {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.ajio.com/api/category/830?text=${encodeURIComponent(q)}&pageSize=5&currentPage=0&format=json`, render: false, country_code: 'in' },
    timeout: 15000
  });
  console.log('Top keys:', Object.keys(data || {}));
  console.log('Full sample:', JSON.stringify(data).slice(0, 800));
} catch(e) { console.log('Error:', e?.response?.status, e?.message); }

console.log('\n=== Ajio search API ===');
try {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=5&currentPage=0&format=json&sortBy=price-asc`, render: false, country_code: 'in' },
    timeout: 15000
  });
  console.log('Top keys:', Object.keys(data || {}));
  // check nested
  for (const k of Object.keys(data || {})) {
    const v = data[k];
    if (v && typeof v === 'object') console.log(`  ${k}:`, Array.isArray(v) ? `array[${v.length}]` : Object.keys(v).slice(0,5).join(','));
  }
  console.log('Full sample:', JSON.stringify(data).slice(0, 800));
} catch(e) { console.log('Error:', e?.response?.status, e?.message); }

// Try Ajio with Indian IP header
console.log('\n=== Ajio with country_code=in + headers ===');
try {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=5&currentPage=0&format=json`, render: false, country_code: 'in', device_type: 'mobile' },
    timeout: 15000
  });
  console.log('Top keys:', Object.keys(data || {}));
  const sr = data?.searchresult;
  if (sr) console.log('searchresult keys:', Object.keys(sr));
  console.log('Full sample:', JSON.stringify(data).slice(0, 600));
} catch(e) { console.log('Error:', e?.response?.status, e?.message); }
