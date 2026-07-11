// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const SCRAPER_KEY = process.env.SCRAPER_API_KEY || '';

async function proxyGet(targetUrl: string, extraHeaders: Record<string, string> = {}): Promise<any> {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: { api_key: SCRAPER_KEY, url: targetUrl, render: false, country_code: 'in' },
    headers: { Accept: 'application/json', ...extraHeaders },
    timeout: 25000,
  });
  return data;
}

async function testPlatform(name: string, fn: () => Promise<any>): Promise<{
  platform: string;
  status: 'ok' | 'error' | 'empty';
  result?: any;
  error?: string;
  ms: number;
}> {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    if (!result) return { platform: name, status: 'empty', ms };
    return { platform: name, status: 'ok', result, ms };
  } catch (e: any) {
    return {
      platform: name,
      status: 'error',
      error: `${e?.response?.status || ''} ${e?.message || String(e)}`.trim(),
      ms: Date.now() - start,
    };
  }
}

async function debugSearch(req: VercelRequest, res: VercelResponse) {
  const query = (req.query.q as string) || 'kurta';

  const results = await Promise.all([

    testPlatform('amazon_structured', async () => {
      const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
        params: { api_key: SCRAPER_KEY, query, country_code: 'in', tld: 'in' },
        timeout: 25000,
      });
      const products = data?.results || data?.organic_results || [];
      return { 
        count: products.length, 
        first3: products.slice(0, 3).map((p: any) => ({ 
          title: p.name || p.title, 
          price: p.price,
          price_type: typeof p.price,
          original_price: p.original_price,
          image: p.image ? 'yes' : 'no',
          asin: p.asin,
          all_keys: Object.keys(p)
        }))
      };
    }),

    testPlatform('flipkart_structured', async () => {
      const { data } = await axios.get('https://api.scraperapi.com/structured/flipkart/search', {
        params: { api_key: SCRAPER_KEY, query },
        timeout: 25000,
      });
      const products = data?.results || data?.organic_results || [];
      return { count: products.length, first: products[0] ? { title: products[0].name || products[0].title, price: products[0].price } : null, raw_keys: Object.keys(data || {}) };
    }),

    testPlatform('scraper_credits', async () => {
      const { data } = await axios.get('https://api.scraperapi.com/account', {
        params: { api_key: SCRAPER_KEY },
        timeout: 10000,
      });
      return data;
    }),

  ]);

  return res.json({ query, timestamp: new Date().toISOString(), structured_test: results });
}

async function debugSearchOld(req: VercelRequest, res: VercelResponse) {
  const query = (req.query.q as string) || 'kurta';

  const results = await Promise.all([

    testPlatform('env_check', async () => ({
      SCRAPER_API_KEY: SCRAPER_KEY ? `set (${SCRAPER_KEY.slice(0, 6)}...)` : 'NOT SET — this is why nothing works',
      FLIPKART_ID: process.env.AFFILIATE_FLIPKART_ID ? 'set' : 'not set',
      MONGO_URI: process.env.MONGO_URI ? 'set' : 'not set',
    })),

    testPlatform('meesho', async () => {
      const { data } = await axios.post(
        'https://api.scraperapi.com/',
        JSON.stringify({ query, page: 1, limit: 5, filters: {}, sort: 'price_asc' }),
        {
          params: { api_key: SCRAPER_KEY, url: 'https://www.meesho.com/api/v1/products/search', render: false },
          headers: { 'Content-Type': 'application/json', 'x-meesho-client': 'meesho-web', Accept: 'application/json' },
          timeout: 20000,
        }
      );
      const products = data?.data?.products || data?.products || [];
      if (!products.length) return null;
      const p = products[0];
      return { title: p.name, price: p.min_price || p.price };
    }),

    testPlatform('ajio', async () => {
      const data = await proxyGet(
        `https://www.ajio.com/api/search?text=${encodeURIComponent(query)}&pageSize=5&currentPage=0&format=json&sortBy=price-asc`,
        { Referer: 'https://www.ajio.com/' }
      );
      const products = data?.searchresult?.products || data?.products || [];
      if (!products.length) return null;
      const p = products[0];
      return { title: `${p.brandname} ${p.name}`, price: p.price?.value };
    }),

    testPlatform('nykaa', async () => {
      const data = await proxyGet(
        `https://www.nykaafashion.com/rest/appapi/V2/search/result?q=${encodeURIComponent(query)}&page=1&pageSize=5&sortBy=price_asc`,
        { Referer: 'https://www.nykaafashion.com/' }
      );
      const products = data?.response?.products || data?.products || [];
      if (!products.length) return null;
      const p = products[0];
      return { title: `${p.brand_name} ${p.name}`, price: p.price || p.selling_price };
    }),

    testPlatform('tatacliq', async () => {
      const data = await proxyGet(
        `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(query)}&pageSize=5&currentPage=0&sortBy=price-asc`,
        { Referer: 'https://www.tatacliq.com/' }
      );
      const products = data?.searchresult?.products || data?.products || [];
      if (!products.length) return null;
      const p = products[0];
      return { title: `${p.brandname} ${p.name}`, price: p.price?.value || p.sellingPrice };
    }),

    testPlatform('myntra', async () => {
      const data = await proxyGet(
        `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(query)}?p=1&rows=5&o=0&plaEnabled=false&sort=price_asc`,
        { 'x-location-code': 'MH', 'x-myntraweb': 'Yes', Referer: 'https://www.myntra.com/' }
      );
      const products = data?.products || data?.searchData?.results || [];
      if (!products.length) return null;
      const p = products[0];
      return { title: `${p.brand} ${p.productName}`, price: p.price || p.sellingPrice };
    }),

    testPlatform('flipkart', async () => {
      if (!SCRAPER_KEY) return { skipped: 'SCRAPER_API_KEY not set' };
      const { data: html } = await axios.get('https://api.scraperapi.com/', {
        params: {
          api_key: SCRAPER_KEY,
          url: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`,
          render: false,
          country_code: 'in',
        },
        timeout: 25000,
      });
      const titleMatch = typeof html === 'string' && html.match(/class="[^"]*(?:KzDlHZ|s1Q9rs|IRpwTa|wjcEIp|_4rR01T|WKTcLC)[^"]*"[^>]*>([^<]{5,80})</i);
      const priceMatch = typeof html === 'string' && html.match(/class="[^"]*(?:Nx9bqj|_30jeq3|_1_WHN1|hl05au)[^"]*"[^>]*>₹([\d,]+)/i);
      return {
        html_length: typeof html === 'string' ? html.length : 0,
        title_found: titleMatch?.[1] || null,
        price_found: priceMatch?.[1] || null,
        has_captcha: typeof html === 'string' && (html.includes('captcha') || html.includes('robot')),
      };
    }),

    testPlatform('amazon', async () => {
      if (!SCRAPER_KEY) return { skipped: 'SCRAPER_API_KEY not set' };
      const { data: html } = await axios.get('https://api.scraperapi.com/', {
        params: {
          api_key: SCRAPER_KEY,
          url: `https://www.amazon.in/s?k=${encodeURIComponent(query)}&i=fashion`,
          render: false,
          country_code: 'in',
        },
        timeout: 25000,
      });
      const titles = typeof html === 'string'
        ? [...html.matchAll(/<span[^>]*class="[^"]*a-size-medium[^"]*a-color-base[^"]*s-inline[^"]*"[^>]*>([^<]+)<\/span>/gi)].map(x => x[1]).slice(0, 2)
        : [];
      const prices = typeof html === 'string'
        ? [...html.matchAll(/<span[^>]*class="a-price-whole"[^>]*>([\d,]+)/gi)].map(x => x[1]).slice(0, 2)
        : [];
      return {
        html_length: typeof html === 'string' ? html.length : 0,
        titles_found: titles,
        prices_found: prices,
        has_captcha: typeof html === 'string' && (html.includes('captcha') || html.includes('robot')),
      };
    }),

  ]);

  return res.json({ query, timestamp: new Date().toISOString(), results });
}

async function debugLiveSearch(req: VercelRequest, res: VercelResponse) {
  const query = (req.query.q as string) || 'kurta';
  try {
    const { searchProducts } = await import('../search.js');
    const products = await searchProducts(query);
    return res.json({ query, count: products.length, products });
  } catch (e: any) {
    return res.status(500).json({ error: e.message, stack: e.stack?.slice(0, 500) });
  }
}

export async function handleDebug(req: VercelRequest, res: VercelResponse, subpath: string) {
  if (subpath === 'search') return debugSearch(req, res);
  if (subpath === 'search-old') return debugSearchOld(req, res);
  if (subpath === 'live') return debugLiveSearch(req, res);
  return res.status(404).json({ error: 'Not found' });
}
