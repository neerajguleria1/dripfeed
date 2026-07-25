// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  searchProducts,
  searchProductsWithMeta,
  searchProductsStreaming,
  getRelatedProducts,
  getMemCached,
  getDbCached,
  normalizeQuery,
  groupSearchResults,
} from '../search.js';
import { cacheStats, buildCacheMeta } from '../cache/policy.js';
import { connectDB } from '../db.js';
import Product from '../models/Product.js';
import type { CanonicalProduct } from '../types/canonicalProduct.js';

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
 */
function cleanProductTitle(title: string): string {
  return title
    .replace(/\s*[-–—]\s*(myntra|ajio|amazon|flipkart|meesho|nykaa|tata\s*cliq|bewakoof)\s*(edition|collection|picks|exclusive)s?\s*$/i, '')
    .replace(/\s*[-–—]\s*(india\s*)?(edition|collection|picks)s?\s*$/i, '')
    .trim();
}

/**
 * Serialize a CanonicalProduct for the wire. Cleans titles and ensures every
 * offer's affiliateUrl is present (falls back to productUrl).
 */
function serializeCanonical(c: CanonicalProduct) {
  return {
    id: c.id,
    title: cleanProductTitle(c.title),
    brand: c.brand,
    offerCount: c.offerCount,
    confidence: c.confidence,
    offers: c.offers.map(o => ({
      platform:          o.platform,
      platformProductId: o.platformProductId,
      title:             cleanProductTitle(o.title),
      price:             o.price,
      originalPrice:     o.originalPrice,
      discount:          o.discount,
      imageUrl:          o.imageUrl,
      productUrl:        o.productUrl,
      affiliateUrl:      o.affiliateUrl ?? o.productUrl,
      color:             o.color,
      size:              o.size,
      rating:            o.rating,
    })),
  };
}

/**
 * Extract a meaningful product name from a URL.
 */
function extractProductNameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (host.includes('amazon')) {
      const kParam = parsed.searchParams.get('k');
      if (kParam) return kParam;
      const dpIndex = parts.indexOf('dp');
      if (dpIndex > 0) return parts[dpIndex - 1].replace(/[-_]/g, ' ').trim();
      if (dpIndex === 0 && parts[1]) return parts[1];
      return parts[0]?.replace(/[-_]/g, ' ').trim() || null;
    }
    if (host.includes('flipkart')) {
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      return slug.replace(/[-_]/g, ' ').replace(/\b(itm\w+)\b/gi, '').trim() || null;
    }
    if (host.includes('myntra')) {
      const slug = parts
        .filter(p => !/^\d+$/.test(p) && p !== 'buy' && p.length > 3)
        .sort((a, b) => b.length - a.length)[0] || '';
      return slug.replace(/[-_]/g, ' ').trim() || null;
    }
    if (host.includes('ajio')) {
      const slug = parts
        .filter(p => p !== 'p' && p !== 's' && p.length > 3 && !/^[A-Z0-9]{8,}$/.test(p))
        .sort((a, b) => b.length - a.length)[0] || '';
      return slug.replace(/[-_]/g, ' ').replace(/\d{4,}/g, '').trim() || null;
    }
    if (host.includes('meesho')) {
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      return slug.replace(/[-_]/g, ' ').trim() || null;
    }
    if (host.includes('nykaa') || host.includes('tatacliq')) {
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      return slug.replace(/[-_]/g, ' ').trim() || null;
    }
    const slug = parts
      .filter(p => p.length > 3 && !/^\d+$/.test(p) && !['p', 'dp', 'buy', 'itm', 'search'].includes(p))
      .sort((a, b) => b.length - a.length)[0] || '';
    return slug.replace(/[-_]/g, ' ').trim() || null;
  } catch {
    return null;
  }
}

// --- Product Search (blocking) ---

async function productSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'Query is required' });

  const bypassCache = req.query.refresh === '1';

  let searchTerm = query.trim();
  if (searchTerm.startsWith('http://') || searchTerm.startsWith('https://')) {
    const extracted = extractProductNameFromUrl(searchTerm);
    if (extracted && extracted.length >= 3) {
      searchTerm = extracted;
    } else {
      return res.status(400).json({ error: 'Could not extract product name from this URL. Try searching by product name instead.', products: [] });
    }
  }

  try {
    const { canonicals, meta } = await searchProductsWithMeta(searchTerm, bypassCache);
    return res.json({
      products: canonicals.map(serializeCanonical),
      query: searchTerm,
      cacheMeta: meta,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Search failed', message: e.message });
  }
}

// --- Streaming Product Search (Server-Sent Events) ---
// SSE protocol:
//   { type: 'platform', platform: string, products: SearchProduct[] }  — per-platform raw arrival (drives status pills)
//   { type: 'canonicals', canonicals: SerializedCanonical[] }          — final grouped result sent once after all platforms settle
//   { type: 'done', query: string }                                     — stream complete
//   { type: 'error', message: string }                                  — failure

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
    if (!process.env.SCRAPER_API_KEY) {
      send({ type: 'error', message: 'no_keys' });
      clearInterval(heartbeat);
      return res.end();
    }

    // Cache-first: if we have a cached flat list, group it and send immediately
    const bypassCache = (req.query.refresh as string) === '1';
    const cacheKey = normalizeQuery(searchTerm);

    if (!bypassCache) {
      const cached = getMemCached(cacheKey) ?? await getDbCached(cacheKey);
      if (cached) {
        const canonicals = groupSearchResults(cached.data);
        send({ type: 'canonicals', canonicals: canonicals.map(serializeCanonical), cacheMeta: cached.meta });
        send({ type: 'done', query: searchTerm });
        clearInterval(heartbeat);
        return res.end();
      }
    }

    // Live fetch: onPlatform fires per-platform for the status pills,
    // then we send the final grouped canonicals once all platforms settle.
    const { canonicals, meta } = await searchProductsStreaming(
      searchTerm,
      (platform, products) => {
        send({ type: 'platform', platform, count: products.length });
      },
      true, // skipCacheCheck — already checked above
    );

    send({ type: 'canonicals', canonicals: canonicals.map(serializeCanonical), cacheMeta: meta });
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = (req.query.q as string) || '';

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
    return res.json({
      label: result.label,
      sections: result.sections.map(s => ({
        query: s.query,
        products: s.products.map(serializeCanonical),
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed', message: e.message });
  }
}

export async function handleSearch(req: VercelRequest, res: VercelResponse, subpath: string) {
  switch (subpath) {
    case 'product':        return productSearch(req, res);
    case 'product/stream': return productSearchStream(req, res);
    case 'suggestions':    return suggestions(req, res);
    case 'related':        return relatedProducts(req, res);
    case 'cache-stats':    return res.json(cacheStats);
    default:               return res.status(404).json({ error: 'Not found' });
  }
}
