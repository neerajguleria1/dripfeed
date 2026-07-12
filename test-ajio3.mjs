import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';
const q = 'saree';

const { data: html } = await axios.get('https://api.scraperapi.com/', {
  params: { api_key: key, url: `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`, render: false, country_code: 'in' },
  timeout: 15000
});

// Extract __PRELOADED_STATE__
const m = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
if (!m) { console.log('__PRELOADED_STATE__ not found'); process.exit(); }

try {
  const state = JSON.parse(m[1]);
  console.log('Top keys:', Object.keys(state).slice(0, 15));
  
  // Find products
  function findProducts(obj, path = '', depth = 0) {
    if (depth > 5) return;
    for (const [k, v] of Object.entries(obj || {})) {
      const p = path ? `${path}.${k}` : k;
      if (Array.isArray(v) && v.length > 0 && v[0]?.name && (v[0]?.price || v[0]?.sellingPrice)) {
        console.log(`\n✅ Products found at: ${p} (${v.length} items)`);
        console.log('First product:', JSON.stringify(v[0]).slice(0, 300));
        return;
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) findProducts(v, p, depth + 1);
    }
  }
  findProducts(state);
} catch(e) {
  console.log('Parse error:', e.message);
  // Try to find the extent of the JSON
  console.log('State sample:', m[1].slice(0, 500));
}
