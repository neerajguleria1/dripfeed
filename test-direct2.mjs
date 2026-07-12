import axios from 'axios';
const q = 'saree';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-IN,en;q=0.9',
};

// TataCliq — what's in the array?
console.log('=== TataCliq ===');
try {
  const { data } = await axios.get(
    `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(q)}&pageSize=5&currentPage=0&sortBy=price-asc`,
    { headers: { ...HEADERS, 'Referer': 'https://www.tatacliq.com/' }, timeout: 10000 }
  );
  console.log('Type:', typeof data, Array.isArray(data) ? `array[${data.length}]` : '');
  console.log('Sample:', JSON.stringify(data).slice(0, 400));
} catch(e) { console.log('Error:', e?.response?.status, e?.message); }

// Ajio — try with cookies/session
console.log('\n=== Ajio with more headers ===');
try {
  const { data } = await axios.get(
    `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=5&currentPage=0&format=json`,
    { 
      headers: { 
        ...HEADERS, 
        'Referer': 'https://www.ajio.com/search/?text=saree',
        'Origin': 'https://www.ajio.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'x-requested-with': 'XMLHttpRequest',
      }, 
      timeout: 10000 
    }
  );
  console.log('Keys:', Object.keys(data||{}));
  console.log('Sample:', JSON.stringify(data).slice(0, 300));
} catch(e) { console.log('Error:', e?.response?.status, e?.message); }

// Ajio — try the actual XHR endpoint used by browser (different path)
console.log('\n=== Ajio XHR endpoint ===');
try {
  const { data } = await axios.get(
    `https://www.ajio.com/api/search?text=${encodeURIComponent(q)}&pageSize=5&currentPage=0&format=json&sortBy=price-asc&lang=en&curr=INR`,
    { 
      headers: { 
        ...HEADERS,
        'Referer': 'https://www.ajio.com/',
        'sec-ch-ua': '"Google Chrome";v="125"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      }, 
      timeout: 10000 
    }
  );
  const p = data?.searchresult?.products || [];
  console.log('Products:', p.length, '| All keys:', Object.keys(data||{}));
  if (p.length) console.log('First:', JSON.stringify(p[0]).slice(0,200));
  else console.log('Full response:', JSON.stringify(data).slice(0,300));
} catch(e) { console.log('Error:', e?.response?.status, e?.message); }
