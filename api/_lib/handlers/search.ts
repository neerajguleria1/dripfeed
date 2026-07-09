// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import Product from '../models/Product.js';
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

// --- Product Search ---

async function productSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    // Use real scraper first
    const results = await searchProducts(query.trim());

    // Clean titles
    const cleaned = results.map((p) => ({
      ...p,
      title: cleanProductTitle(p.title),
    }));

    res.json({ products: cleaned, query: query.trim() });
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
