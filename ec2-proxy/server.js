const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

let myntraSession = { cookies: '', ts: 0 };
const SESSION_TTL = 25 * 60 * 1000;

async function getMyntraSession() {
  if (myntraSession.cookies && Date.now() - myntraSession.ts < SESSION_TTL) return myntraSession.cookies;
  const resp = await axios.get('https://www.myntra.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
    },
    timeout: 10000,
    maxRedirects: 5,
  });
  const raw = resp.headers['set-cookie'] || [];
  myntraSession.cookies = raw.map(c => c.split(';')[0]).join('; ');
  myntraSession.ts = Date.now();
  return myntraSession.cookies;
}

app.get('/myntra/:query', async (req, res) => {
  try {
    const cookies = await getMyntraSession();
    const { data } = await axios.get(
      `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(req.params.query)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-IN,en;q=0.9',
          'Referer': 'https://www.myntra.com/',
          'Cookie': cookies,
          'x-myntraweb': 'Yes',
          'x-location-code': 'MH',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
        },
        timeout: 15000,
      }
    );
    res.json({ products: data?.products || [] });
  } catch (e) {
    res.status(500).json({ products: [], error: e?.response?.status || e?.message });
  }
});

app.get('/ajio/:query', async (req, res) => {
  try {
    const { data } = await axios.get(
      `https://www.ajio.com/api/search?text=${encodeURIComponent(req.params.query)}&pageSize=20&currentPage=0`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.ajio.com/',
        },
        timeout: 15000,
      }
    );
    res.json({ products: data?.products || [] });
  } catch (e) {
    res.status(500).json({ products: [], error: e?.response?.status || e?.message });
  }
});

app.get('/meesho/:query', async (req, res) => {
  try {
    const { data } = await axios.post(
      'https://meesho.com/api/v1/products/search',
      { query: req.params.query, page: 1, limit: 20 },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
          'Referer': 'https://meesho.com/',
        },
        timeout: 15000,
      }
    );
    res.json({ products: data?.data?.products || data?.products || [] });
  } catch (e) {
    res.status(500).json({ products: [], error: e?.response?.status || e?.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true, region: 'ap-south-1' }));

app.listen(3001, () => console.log('Proxy running on port 3001'));
