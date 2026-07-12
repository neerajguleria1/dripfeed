// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export const config = { maxDuration: 30, regions: ['bom1'] }; // Mumbai

const ALLOWED_HOSTS = new Set([
  'www.myntra.com',
  'www.ajio.com',
  'www.meesho.com',
  'www.tatacliq.com',
  'www.nykaafashion.com',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).json({ error: 'url param required' });

  let parsed: URL;
  try { parsed = new URL(targetUrl); }
  catch { return res.status(400).json({ error: 'invalid url' }); }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(403).json({ error: 'host not allowed' });
  }

  const host = parsed.hostname;
  try {
    const response = await axios({
      method: (req.method as any) || 'GET',
      url: targetUrl,
      data: req.method === 'POST' ? req.body : undefined,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Referer': `https://${host}/`,
        'Origin': `https://${host}`,
        ...(host.includes('myntra') && { 'x-myntraweb': 'Yes', 'x-location-code': 'MH' }),
        ...(host.includes('meesho') && { 'x-meesho-client': 'meesho-web' }),
      },
      timeout: 25000,
    });
    return res.status(200).json(response.data);
  } catch (e: any) {
    return res.status(e?.response?.status || 500).json({
      error: e?.message,
      status: e?.response?.status,
    });
  }
}
