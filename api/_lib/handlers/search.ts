// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
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

// --- Product Search ---

function generateSearchResults(query: string) {
  const platforms = [
    { name: 'Amazon India', color: '#FF9900' },
    { name: 'Flipkart', color: '#2874F0' },
    { name: 'Myntra', color: '#FF3F6C' },
    { name: 'Ajio', color: '#000000' },
    { name: 'Meesho', color: '#570A57' },
    { name: 'Nykaa Fashion', color: '#FC2779' },
    { name: 'Tata CLiQ', color: '#4A148C' },
  ];

  const basePrice = 1000 + Math.floor(Math.random() * 4000);
  const results: any[] = [];

  for (const platform of platforms) {
    const variation = 0.7 + Math.random() * 0.6;
    const price = Math.round(basePrice * variation);
    const originalPrice = Math.round(price * (1.2 + Math.random() * 0.5));
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

    results.push({
      title: `${query} - ${platform.name} Edition`,
      brand: query.split(' ')[0],
      platform: platform.name,
      price,
      originalPrice,
      discount,
      url: `https://www.${platform.name.toLowerCase().replace(/\s+/g, '')}.com/search?q=${encodeURIComponent(query)}`,
      imageUrl: `https://placehold.co/300x400/f8f5f2/051F45?text=${encodeURIComponent(query.slice(0, 10))}`,
      rating: (3.5 + Math.random() * 1.5).toFixed(1),
      inStock: Math.random() > 0.1,
    });
  }

  return results.sort((a, b) => a.price - b.price);
}

async function productSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    const products = generateSearchResults(query.trim());
    res.json({ products, query: query.trim() });
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
