// Cloudflare Worker — session-based proxy for Indian fashion platforms
// Myntra: get homepage cookies first, then call API (bypasses bot detection)

const ALLOWED = new Set([
  'www.myntra.com',
  'www.ajio.com',
  'www.meesho.com',
  'www.tatacliq.com',
]);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Cache cookies per hostname (Cloudflare Worker global scope persists per isolate)
const cookieCache = new Map();

async function getSessionCookies(hostname) {
  if (cookieCache.has(hostname)) return cookieCache.get(hostname);
  try {
    const resp = await fetch(`https://${hostname}/`, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      },
    });
    const cookies = resp.headers.get('set-cookie') || '';
    // Parse multiple set-cookie headers
    const parsed = cookies.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    cookieCache.set(hostname, parsed);
    // Expire cache after 30 minutes
    setTimeout(() => cookieCache.delete(hostname), 30 * 60 * 1000);
    return parsed;
  } catch { return ''; }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return json({ error: 'url param required' }, 400);

    let parsed;
    try { parsed = new URL(target); }
    catch { return json({ error: 'invalid url' }, 400); }

    if (!ALLOWED.has(parsed.hostname)) return json({ error: 'host not allowed' }, 403);

    const host = parsed.hostname;
    const cookies = await getSessionCookies(host);

    const headers = {
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      'Referer': `https://${host}/`,
      'Origin': `https://${host}`,
      'Cookie': cookies,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
    };

    if (host.includes('myntra')) {
      headers['x-myntraweb'] = 'Yes';
      headers['x-location-code'] = 'MH';
    }

    try {
      const body = request.method === 'POST' ? await request.text() : undefined;
      const resp = await fetch(target, { method: request.method, headers, body });
      const text = await resp.text();

      return new Response(text, {
        status: resp.status,
        headers: {
          'Content-Type': resp.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
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
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
