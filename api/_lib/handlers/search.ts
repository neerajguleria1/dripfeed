// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchProducts, searchProductsStreaming, getRelatedProducts, getMemCached, getDbCached, normalizeQuery } from '../search.js';
import { connectDB } from '../db.js';
import Product from '../models/Product.js';

const TRENDING_SEARCHES = [
  'kurta',
  'sneakers',
  'saree',
  'lehenga',
  'jeans',
  'hoodie',
  'dress',
  'palazzo',
];

/**
 * Strip platform/category suffixes from titles.
 * Removes patterns like "- Myntra Edition", "- Ajio Collection", "- Flipkart Picks"
 */
function cleanProductTitle(title: string): string {
  return title
    .replace(/\s*[-–—]\s*(myntra|ajio|amazon|flipkart|meesho|nykaa|tata\s*cliq|bewakoof)\s*(edition|collection|picks|exclusive)s?\s*$/i, '')
    .replace(/\s*[-–—]\s*(india\s*)?(edition|collection|picks)s?\s*$/i, '')
    .trim();
}

/**
 * Extract a meaningful product name from a URL.
 * Handles Flipkart, Myntra, Amazon, Ajio, Meesho, Nykaa, TataCliq URL patterns.
 */
function extractProductNameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split('/').filter(Boolean);

    // Amazon: /dp/ASIN or /product-name/dp/ASIN or /s?k=query
    if (host.includes('amazon')) {
      const kParam = parsed.searchParams.get('k');
      if (kParam) return kParam;
      const dpIndex = parts.indexOf('dp');
      // /product-name/dp/ASIN — slug is before dp
      if (dpIndex > 0) return parts[dpIndex - 1].replace(/[-_]/g, ' ').trim();
      // /dp/ASIN — fetch title from ASIN directly via structured API
      // Return the ASIN as search term — Amazon structured will find it
      if (dpIndex === 0 && parts[1]) return parts[1]; // return ASIN, handled below
      return parts[0]?.replace(/[-_]/g, ' ').trim() || null;
    }

    // Flipkart: /product-name-slug/p/itemid
    if (host.includes('flipkart')) {
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      return slug.replace(/[-_]/g, ' ').replace(/\b(itm\w+)\b/gi, '').trim() || null;
    }

    // Myntra: /category/brand/brand-product-long-name/productId/buy
    // Pick the LONGEST non-numeric segment — that's the full product slug
    if (host.includes('myntra')) {
      const slug = parts
        .filter(p => !/^\d+$/.test(p) && p !== 'buy' && p.length > 3)
        .sort((a, b) => b.length - a.length)[0] || '';
      return slug.replace(/[-_]/g, ' ').trim() || null;
    }

    // Ajio: /brand/product-slug/p/productcode
    if (host.includes('ajio')) {
      const slug = parts
        .filter(p => p !== 'p' && p !== 's' && p.length > 3 && !/^[A-Z0-9]{8,}$/.test(p))
        .sort((a, b) => b.length - a.length)[0] || '';
      return slug.replace(/[-_]/g, ' ').replace(/\d{4,}/g, '').trim() || null;
    }

    // Meesho: /product-name/p/product-id
    if (host.includes('meesho')) {
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      return slug.replace(/[-_]/g, ' ').trim() || null;
    }

    // Nykaa / TataCliq: /product-name/p/product-id
    if (host.includes('nykaa') || host.includes('tatacliq')) {
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      return slug.replace(/[-_]/g, ' ').trim() || null;
    }

    // Generic: longest non-numeric segment
    const slug = parts
      .filter(p => p.length > 3 && !/^\d+$/.test(p) && !['p', 'dp', 'buy', 'itm', 'search'].includes(p))
      .sort((a, b) => b.length - a.length)[0] || '';
    return slug.replace(/[-_]/g, ' ').trim() || null;
  } catch {
    return null;
  }
}

// --- Product Search ---

async function productSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'Query is required' });

  let searchTerm = query.trim();

  // If the query looks like a URL, extract the product name from it
  if (searchTerm.startsWith('http://') || searchTerm.startsWith('https://')) {
    const extracted = extractProductNameFromUrl(searchTerm);
    if (extracted && extracted.length >= 3) {
      searchTerm = extracted;
    } else {
      return res.status(400).json({ error: 'Could not extract product name from this URL. Try searching by product name instead.', products: [] });
    }
  }

  try {
    // Always run live scrapers first — they search all 7 platforms in parallel
    // and return the cheapest result per platform.
    const results = await searchProducts(searchTerm);

    const cleaned = results.map((p) => ({
      ...p,
      title: cleanProductTitle(p.title),
    }));
    return res.json({ products: cleaned, query: searchTerm, source: 'live' });

  } catch (e: any) {
    res.status(500).json({ error: 'Search failed', message: e.message });
  }
}

// --- Streaming Product Search (Server-Sent Events) ---
// Sends partial results the moment each platform (Amazon/Flipkart/Myntra/Ajio)
// resolves, instead of making the client wait for the slowest platform.
// Event types sent to the client:
//   { type: 'platform', platform: 'amazon', products: [...] }  — sent per platform as it completes
//   { type: 'done', query }                                     — sent once all platforms have resolved
//   { type: 'error', message }                                  — sent on unexpected failure

async function productSearchStream(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rawQuery = (req.query.q as string) || '';
  if (!rawQuery || !rawQuery.trim()) return res.status(400).json({ error: 'Query parameter q is required' });

  let searchTerm = rawQuery.trim();
  if (searchTerm.startsWith('http://') || searchTerm.startsWith('https://')) {
    const extracted = extractProductNameFromUrl(searchTerm);
    if (extracted && extracted.length >= 3) {
      searchTerm = extracted;
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Could not extract product name from this URL.' }));
    }
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    // @ts-ignore
    if (typeof res.flush === 'function') res.flush();
  };

  const heartbeat = setInterval(() => res.write(':\n\n'), 15000);

  try {
    // No ScraperAPI keys configured — fail fast with a clear error instead of
    // silently returning empty results that look like "no products found".
    if (!process.env.SCRAPER_API_KEY) {
      send({ type: 'error', message: 'no_keys' });
      clearInterval(heartbeat);
      return res.end();
    }

    // Cache-first flush: if this query was already fetched, send cached results
    // immediately (~0ms) so the UI shows results before the live scrape even starts.
    const cacheKey = normalizeQuery(searchTerm);
    const cached = getMemCached(cacheKey) || await getDbCached(cacheKey);
    if (cached && cached.length > 0) {
      const cleaned = cached.map((p) => ({ ...p, title: cleanProductTitle(p.title) }));
      send({ type: 'platform', platform: 'cache', products: cleaned });
      send({ type: 'done', query: searchTerm });
      clearInterval(heartbeat);
      return res.end();
    }

    await searchProductsStreaming(searchTerm, (platform, products) => {
      const cleaned = products.map((p) => ({ ...p, title: cleanProductTitle(p.title) }));
      send({ type: 'platform', platform, products: cleaned });
    });
    send({ type: 'done', query: searchTerm });
  } catch (e: any) {
    send({ type: 'error', message: e?.message || 'Search failed' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

// --- Suggestions ---

async function suggestions(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = (req.query.q as string) || '';
  const _userId = req.query.userId as string | undefined;

  try {
    const trending = TRENDING_SEARCHES;
    const recent: string[] = [];

    let products: Array<{ title: string; brand?: string; imageUrl?: string }> = [];

    if (q.trim().length >= 2) {
      await connectDB();
      const regex = new RegExp(q.trim(), 'i');
      const matches = await Product.find({ title: regex })
        .select('title brand imageUrl')
        .limit(5)
        .lean();

      products = matches.map((p) => ({
        title: p.title,
        brand: p.brand || undefined,
        imageUrl: p.imageUrl || undefined,
      }));
    }

    return res.status(200).json({ recent, trending, products });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch suggestions', message: e.message });
  }
}

// --- Related Products ---

async function relatedProducts(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const query = (req.query.q as string || '').trim();
  if (!query) return res.status(400).json({ error: 'Query is required' });
  try {
    const result = await getRelatedProducts(query);
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed', message: e.message });
  }
}

export async function handleSearch(req: VercelRequest, res: VercelResponse, subpath: string) {
  switch (subpath) {
    case 'product': return productSearch(req, res);
    case 'product/stream': return productSearchStream(req, res);
    case 'suggestions': return suggestions(req, res);
    case 'related': return relatedProducts(req, res);
    default: return res.status(404).json({ error: 'Not found' });
  }
}
