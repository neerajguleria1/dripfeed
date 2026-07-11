// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchProducts } from '../search.js';

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
    const path = parsed.pathname;

    // Flipkart: /product-name/p/itm123 or /product-name/pid
    if (host.includes('flipkart')) {
      const parts = path.split('/').filter(Boolean);
      // Find slug before /p/ or first meaningful slug
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      const cleaned = slug.replace(/[-_]/g, ' ').replace(/\b(p|pid|itm\w+)\b/gi, '').trim();
      return cleaned.length >= 3 ? cleaned : null;
    }

    // Myntra: /brand-product-name/12345678/buy
    if (host.includes('myntra')) {
      const parts = path.split('/').filter(Boolean);
      // Find the slug part (non-numeric, longer than 3 chars)
      const slug = parts.find(p => p.length > 3 && !/^\d+$/.test(p));
      if (slug) return slug.replace(/[-_]/g, ' ').trim();
      return null;
    }

    // Amazon: /dp/ASIN or /product-name/dp/ASIN
    if (host.includes('amazon')) {
      const parts = path.split('/').filter(Boolean);
      const dpIndex = parts.indexOf('dp');
      if (dpIndex > 0) {
        return parts[dpIndex - 1].replace(/[-_]/g, ' ').trim();
      }
      // /s?k=query
      const kParam = parsed.searchParams.get('k');
      if (kParam) return kParam;
      return parts[0]?.replace(/[-_]/g, ' ').trim() || null;
    }

    // Ajio: /p/product-slug or /brand/product-slug
    if (host.includes('ajio')) {
      const parts = path.split('/').filter(Boolean);
      // Get last meaningful segment (skip 'p')
      const slug = parts.filter(p => p !== 'p' && p.length > 3).pop() || '';
      return slug.replace(/[-_]/g, ' ').replace(/\d{8,}/g, '').trim() || null;
    }

    // Meesho: /product-name/p/product-id
    if (host.includes('meesho')) {
      const parts = path.split('/').filter(Boolean);
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      return slug.replace(/[-_]/g, ' ').trim() || null;
    }

    // Nykaa: /product-name/p/product-id
    if (host.includes('nykaa')) {
      const parts = path.split('/').filter(Boolean);
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      return slug.replace(/[-_]/g, ' ').trim() || null;
    }

    // TataCliq: /product-name/p/product-id
    if (host.includes('tatacliq')) {
      const parts = path.split('/').filter(Boolean);
      const pIndex = parts.indexOf('p');
      const slug = pIndex > 0 ? parts[pIndex - 1] : parts[0] || '';
      return slug.replace(/[-_]/g, ' ').trim() || null;
    }

    // Generic: use last meaningful path segment
    const parts = path.split('/').filter(Boolean);
    const slug = parts.find(p => p.length > 3 && !/^\d+$/.test(p) && !['p', 'dp', 'buy', 'itm'].includes(p));
    if (slug) return slug.replace(/[-_]/g, ' ').trim();

    return null;
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

export async function handleSearch(req: VercelRequest, res: VercelResponse, subpath: string) {
  switch (subpath) {
    case 'product': return productSearch(req, res);
    case 'suggestions': return suggestions(req, res);
    default: return res.status(404).json({ error: 'Not found' });
  }
}
