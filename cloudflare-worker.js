// Cloudflare Worker — CORS proxy for Indian fashion platforms
// Deploy at: https://workers.cloudflare.com
// Free tier: 100,000 requests/day

const ALLOWED = new Set([
  'www.myntra.com',
  'www.ajio.com',
  'www.meesho.com',
  'www.tatacliq.com',
  'www.nykaafashion.com',
]);

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return json({ error: 'url param required' }, 400);

    let parsed;
    try { parsed = new URL(target); }
    catch { return json({ error: 'invalid url' }, 400); }

    if (!ALLOWED.has(parsed.hostname)) {
      return json({ error: 'host not allowed' }, 403);
    }

    const host = parsed.hostname;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': `https://${host}/`,
      'Origin': `https://${host}`,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
    };

    if (host.includes('myntra')) {
      headers['x-myntraweb'] = 'Yes';
      headers['x-location-code'] = 'MH';
      headers['x-meta-app'] = JSON.stringify({ appFamily: 'Web' });
    }
    if (host.includes('meesho')) {
      headers['x-meesho-client'] = 'meesho-web';
      headers['x-meesho-traffic-type'] = 'organic';
    }

    try {
      const body = request.method === 'POST' ? await request.text() : undefined;
      const resp = await fetch(target, {
        method: request.method,
        headers,
        body,
      });

      const data = await resp.text();
      return new Response(data, {
        status: resp.status,
        headers: {
          'Content-Type': resp.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300', // 5min cache at edge
        },
      });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
