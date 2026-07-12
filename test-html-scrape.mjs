import axios from 'axios';
const key = '62dab316fd542f8324cfcd3c396e0674';
const q = 'saree';

async function time(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`✅ ${name}: ${Date.now()-start}ms — ${result}`);
  } catch(e) {
    console.log(`❌ ${name}: ${Date.now()-start}ms — ${e?.response?.status || e?.code} | ${e?.message?.slice(0,60)}`);
  }
}

// Ajio HTML scrape — look for __NEXT_DATA__ or window.__STATE__
await time('Ajio HTML render:false', async () => {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`, render: false, country_code: 'in' },
    timeout: 15000
  });
  if (typeof html !== 'string') return 'not string';
  const hasNext = html.includes('__NEXT_DATA__');
  const hasState = html.includes('__INITIAL_STATE__') || html.includes('window.__STATE__');
  const hasProducts = html.includes('"brandname"') || html.includes('"productName"') || html.includes('"price"');
  // try extract __NEXT_DATA__
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>({[\s\S]*?})<\/script>/);
  if (m) {
    try {
      const nd = JSON.parse(m[1]);
      const products = nd?.props?.pageProps?.searchData?.products || 
                       nd?.props?.pageProps?.products ||
                       nd?.props?.initialState?.search?.products || [];
      return `NEXT_DATA found, products=${products.length}, html=${html.length}`;
    } catch { return `NEXT_DATA parse failed, html=${html.length}`; }
  }
  return `html=${html.length} hasNext=${hasNext} hasState=${hasState} hasProducts=${hasProducts} sample=${html.slice(0,100)}`;
});

// Meesho HTML — Next.js app, look for __NEXT_DATA__
await time('Meesho HTML render:false', async () => {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.meesho.com/search?q=${encodeURIComponent(q)}`, render: false, country_code: 'in' },
    timeout: 15000
  });
  if (typeof html !== 'string') return 'not string';
  const hasNext = html.includes('__NEXT_DATA__');
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>({[\s\S]*?})<\/script>/);
  if (m) {
    try {
      const nd = JSON.parse(m[1]);
      // Meesho stores products in various places
      const products = nd?.props?.pageProps?.searchResults?.products ||
                       nd?.props?.pageProps?.products ||
                       nd?.props?.pageProps?.data?.products || [];
      const keys = JSON.stringify(nd?.props?.pageProps || {}).slice(0, 200);
      return `NEXT_DATA found, products=${products.length}, pageProps keys: ${keys}`;
    } catch(e) { return `NEXT_DATA parse failed: ${e.message}, html=${html.length}`; }
  }
  return `html=${html.length} hasNext=${hasNext} sample=${html.slice(0,150)}`;
});

// TataCliq HTML — look for __NEXT_DATA__
await time('TataCliq HTML render:false', async () => {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(q)}`, render: false, country_code: 'in' },
    timeout: 15000
  });
  if (typeof html !== 'string') return 'not string';
  const hasNext = html.includes('__NEXT_DATA__');
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>({[\s\S]*?})<\/script>/);
  if (m) {
    try {
      const nd = JSON.parse(m[1]);
      const products = nd?.props?.pageProps?.searchData?.products ||
                       nd?.props?.pageProps?.products ||
                       nd?.props?.initialReduxState?.search?.products || [];
      const keys = Object.keys(nd?.props?.pageProps || {}).join(',');
      return `NEXT_DATA found, products=${products.length}, pageProps keys: ${keys}`;
    } catch(e) { return `NEXT_DATA parse failed: ${e.message}`; }
  }
  return `html=${html.length} hasNext=${hasNext} sample=${html.slice(0,150)}`;
});

// Nykaa Fashion HTML
await time('Nykaa Fashion HTML render:false', async () => {
  const { data: html } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: key, url: `https://www.nykaafashion.com/search/result?q=${encodeURIComponent(q)}`, render: false, country_code: 'in' },
    timeout: 15000
  });
  if (typeof html !== 'string') return 'not string';
  const hasNext = html.includes('__NEXT_DATA__');
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>({[\s\S]*?})<\/script>/);
  if (m) {
    try {
      const nd = JSON.parse(m[1]);
      const products = nd?.props?.pageProps?.products || nd?.props?.pageProps?.searchData?.products || [];
      return `NEXT_DATA found, products=${products.length}, pageProps: ${JSON.stringify(nd?.props?.pageProps||{}).slice(0,150)}`;
    } catch(e) { return `NEXT_DATA parse failed: ${e.message}`; }
  }
  return `html=${html.length} hasNext=${hasNext} sample=${html.slice(0,150)}`;
});
