import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Compare prices for a product across platforms.
 * Returns sorted platforms with lowest price highlighted.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = req.query.q as string;
  if (!q || !q.trim()) return res.status(400).json({ error: 'Query parameter q is required' });

  try {
    const platforms = generateComparison(q.trim());
    const sorted = platforms.sort((a, b) => a.price - b.price);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const savings = highest.price - lowest.price;

    res.json({ platforms: sorted, lowest, highest, savings, query: q.trim() });
  } catch (e: any) {
    res.status(500).json({ error: 'Comparison failed', message: e.message });
  }
}

function generateComparison(query: string) {
  const platforms = [
    { name: 'Amazon India', delivery: '2-3 days', returnPolicy: '10-day return' },
    { name: 'Flipkart', delivery: '3-5 days', returnPolicy: '10-day return' },
    { name: 'Myntra', delivery: '4-6 days', returnPolicy: '30-day return' },
    { name: 'Ajio', delivery: '5-7 days', returnPolicy: '15-day return' },
    { name: 'Meesho', delivery: '5-8 days', returnPolicy: '7-day return' },
    { name: 'Nykaa Fashion', delivery: '4-7 days', returnPolicy: '15-day return' },
    { name: 'Tata CLiQ', delivery: '3-5 days', returnPolicy: '30-day return' },
  ];

  const basePrice = 1500 + Math.floor(Math.random() * 3500);

  return platforms.map(p => {
    const variation = 0.75 + Math.random() * 0.5;
    const price = Math.round(basePrice * variation);
    const originalPrice = Math.round(price * (1.15 + Math.random() * 0.4));
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

    return {
      platform: p.name,
      title: `${query}`,
      price,
      originalPrice,
      discount,
      delivery: p.delivery,
      returnPolicy: p.returnPolicy,
      url: `https://www.${p.name.toLowerCase().replace(/\s+/g, '')}.com/product/${encodeURIComponent(query)}`,
      imageUrl: `https://placehold.co/300x400/f8f5f2/051F45?text=${encodeURIComponent(query.slice(0, 10))}`,
      rating: (3.5 + Math.random() * 1.5).toFixed(1),
      inStock: true,
    };
  });
}
