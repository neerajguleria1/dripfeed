import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';
const q = 'saree';

const { data: html } = await axios.get('https://api.scraperapi.com/', {
  params: { api_key: key, url: `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`, render: false, country_code: 'in' },
  timeout: 15000
});

const m = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
const state = JSON.parse(m[1]);

console.log('state.products keys:', Object.keys(state.products || {}));
console.log('state.search keys:', Object.keys(state.search || {}));

// Check products
const prod = state.products;
for (const [k, v] of Object.entries(prod || {})) {
  if (Array.isArray(v)) console.log(`products.${k}: array[${v.length}]`, v[0] ? JSON.stringify(v[0]).slice(0,150) : '');
  else if (v && typeof v === 'object') console.log(`products.${k}: object`, Object.keys(v).slice(0,5));
  else console.log(`products.${k}:`, String(v).slice(0,80));
}

console.log('\n--- search ---');
const srch = state.search;
for (const [k, v] of Object.entries(srch || {})) {
  if (Array.isArray(v)) console.log(`search.${k}: array[${v.length}]`, v[0] ? JSON.stringify(v[0]).slice(0,150) : '');
  else if (v && typeof v === 'object') console.log(`search.${k}: object`, Object.keys(v).slice(0,5));
  else console.log(`search.${k}:`, String(v).slice(0,80));
}
