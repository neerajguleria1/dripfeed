import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

/**
 * Search for products across platforms.
 * For MVP: uses a simple search aggregation approach.
 * TODO: Connect to actual platform APIs (VCommission, Amazon Creators, etc.)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    // For MVP, generate mock-realistic results based on the query
    // This will be replaced with actual API calls once affiliate approvals come through
    const products = generateSearchResults(query.trim());
    res.json({ products, query: query.trim() });
  } catch (e: any) {
    res.status(500).json({ error: 'Search failed', message: e.message });
  }
}

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

  // Generate 2-3 results per platform with realistic price variation
  const basePrice = 1000 + Math.floor(Math.random() * 4000);
  const results: any[] = [];

  for (const platform of platforms) {
    const variation = 0.7 + Math.random() * 0.6; // 70% to 130% of base
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

  // Sort by price ascending
  return results.sort((a, b) => a.price - b.price);
}
