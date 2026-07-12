import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';
const q = 'saree';

// Ajio — find product data in HTML
console.log('=== AJIO ===');
try {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`, render: false, country_code: 'in' },
    timeout: 15000
  });
  // Find brandname occurrences
  const brandMatches = [...html.matchAll(/"brandname"\s*:\s*"([^"]+)"/g)].slice(0, 3);
  const priceMatches = [...html.matchAll(/"price"\s*:\s*\{[^}]*"value"\s*:\s*([\d.]+)/g)].slice(0, 3);
  const nameMatches = [...html.matchAll(/"name"\s*:\s*"([^"]{10,60})"/g)].slice(0, 3);
  console.log('brandname samples:', brandMatches.map(m => m[1]));
  console.log('price samples:', priceMatches.map(m => m[1]));
  console.log('name samples:', nameMatches.map(m => m[1]));
  
  // Try to find window.__STATE__ or similar
  const stateMatch = html.match(/window\.__STATE__\s*=\s*({[\s\S]{0,5000})/);
  const reduxMatch = html.match(/window\.__REDUX_STATE__\s*=\s*({[\s\S]{0,5000})/);
  const dataMatch = html.match(/window\.__DATA__\s*=\s*({[\s\S]{0,5000})/);
  console.log('window.__STATE__:', stateMatch ? 'found' : 'not found');
  console.log('window.__REDUX_STATE__:', reduxMatch ? 'found' : 'not found');
  console.log('window.__DATA__:', dataMatch ? 'found' : 'not found');
  
  // Look for JSON blob with products array
  const jsonBlob = html.match(/"products"\s*:\s*\[(\{[\s\S]{0,2000})/);
  if (jsonBlob) console.log('products blob:', jsonBlob[0].slice(0, 300));
} catch(e) { console.log('Error:', e.message); }

// Meesho — find correct path in NEXT_DATA
console.log('\n=== MEESHO ===');
try {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.meesho.com/search?q=${encodeURIComponent(q)}`, render: false, country_code: 'in' },
    timeout: 15000
  });
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>({[\s\S]*?})<\/script>/);
  if (m) {
    const nd = JSON.parse(m[1]);
    // Print full pageProps keys recursively
    function printKeys(obj, prefix = '', depth = 0) {
      if (depth > 3) return;
      for (const [k, v] of Object.entries(obj || {})) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (Array.isArray(v)) console.log(`  ${path}: array[${v.length}]`, v[0] ? JSON.stringify(v[0]).slice(0,80) : '');
        else if (v && typeof v === 'object') printKeys(v, path, depth + 1);
        else console.log(`  ${path}: ${String(v).slice(0,50)}`);
      }
    }
    printKeys(nd?.props?.pageProps, 'pageProps');
  }
} catch(e) { console.log('Error:', e.message); }
