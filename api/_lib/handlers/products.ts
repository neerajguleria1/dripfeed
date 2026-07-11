// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { connectDB } from '../db.js';
import Deal from '../models/Deal.js';
import Product from '../models/Product.js';

// --- AI Recommend ---

interface AIRecommendation {
  summary: string;
  pros: string[];
  cons: string[];
  recommendation: string;
  bestPlatform: string | null;
  confidence: number;
}

const EMPTY_RESPONSE: AIRecommendation = {
  summary: '',
  pros: [],
  cons: [],
  recommendation: '',
  bestPlatform: null,
  confidence: 0,
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function aiRecommend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { productTitle, platforms, priceHistory: _priceHistory } = req.body || {};
    if (!productTitle) return res.status(400).json({ error: 'productTitle is required' });

    if (!process.env.GROQ_API_KEY) {
      const sorted = (platforms || []).slice().sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
      const cheapest = sorted[0];
      return res.json({
        summary: `Comparing ${productTitle} across ${platforms?.length || 0} platforms.`,
        pros: ['Multiple options available', 'Price comparison saves money'],
        cons: ['Prices may change', 'Stock availability varies'],
        recommendation: cheapest ? `Buy from ${cheapest.platform} for the lowest price.` : 'Compare prices before buying.',
        bestPlatform: cheapest?.platform || null,
        confidence: 0.5,
      } satisfies AIRecommendation);
    }

    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const priceList = (platforms || [])
      .filter((p: any) => p.price)
      .map((p: any) => `- ${p.platform}: ₹${p.price.toLocaleString('en-IN')}`)
      .join('\n');

    const prompt = `Analyze this product for an Indian shopper:

Product: ${productTitle}

Prices across platforms:
${priceList || 'No price data available.'}

Return ONLY valid JSON (no markdown, no backticks):
{
  "summary": "2-sentence product overview",
  "pros": ["pro1", "pro2", "pro3"],
  "cons": ["con1", "con2"],
  "recommendation": "brief buy/wait advice in 1 sentence",
  "bestPlatform": "platform name with best value or null",
  "confidence": 0.85
}

confidence should be a number between 0 and 1 indicating how confident you are in the recommendation.`;

    const completion = await withTimeout(
      client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 512,
      }),
      5000
    );

    const raw = completion.choices[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    const result = JSON.parse(cleaned) as AIRecommendation;

    if (typeof result.confidence !== 'number') {
      result.confidence = 0.7;
    }

    return res.json(result);
  } catch {
    return res.json(EMPTY_RESPONSE);
  }
}

// --- Compare ---

// generateComparison removed — was generating fake random data with placeholder images.
// All comparison data now comes from real scraper results via searchProducts().

async function compare(req: VercelRequest, res: VercelResponse) {
  // Support both GET ?q=... and POST { url: ... }
  if (req.method === 'POST') {
    const { url, query: bodyQuery } = req.body || {};
    const searchTerm = bodyQuery || '';

    if (url) {
      // URL-based comparison: extract product name from URL path, then search
      try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        // Try to get a meaningful product name from the URL slug
        const slug = pathParts[pathParts.length - 1] || pathParts[0] || '';
        const productName = slug
          .replace(/[-_]/g, ' ')
          .replace(/\d{5,}/g, '') // remove long numeric IDs
          .replace(/\s+/g, ' ')
          .trim();

        if (!productName || productName.length < 3) {
          return res.status(400).json({ error: 'Could not extract product name from URL' });
        }

        // Use the real scraper to find the product across platforms
        const { searchProducts } = await import('../search.js');
        const results = await searchProducts(productName);
        const sorted = results.sort((a, b) => a.price - b.price);

        return res.json({
          platforms: sorted,
          products: sorted,
          query: productName,
          sourceUrl: url,
        });
      } catch (e: any) {
        return res.status(400).json({ error: 'Invalid URL', message: e.message });
      }
    }

    if (searchTerm) {
      const { searchProducts } = await import('../search.js');
      const results = await searchProducts(searchTerm);
      if (results.length === 0) {
        return res.json({ platforms: [], products: [], query: searchTerm, message: 'No real product data found. Try a more specific search term.' });
      }
      return res.json({ platforms: results.sort((a, b) => a.price - b.price), products: results.sort((a, b) => a.price - b.price), query: searchTerm });
    }

    return res.status(400).json({ error: 'Provide url or query in request body' });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = req.query.q as string;
  if (!q || !q.trim()) return res.status(400).json({ error: 'Query parameter q is required' });

  try {
    const { searchProducts } = await import('../search.js');
    const results = await searchProducts(q.trim());
    const sorted = results.sort((a, b) => a.price - b.price);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const savings = highest && lowest ? highest.price - lowest.price : 0;

    res.json({ platforms: sorted, lowest, highest, savings, query: q.trim() });
  } catch (e: any) {
    res.status(500).json({ error: 'Comparison failed', message: e.message });
  }
}

// --- Deals ---

async function deals(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectDB();

    const sort = (req.query.sort as string) || 'discount';
    const platform = req.query.platform as string | undefined;
    const minDiscount = Number(req.query.minDiscount) || 0;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { active: true };
    if (platform?.trim()) filter.platform = { $regex: platform.trim(), $options: 'i' };
    if (minDiscount > 0) filter.dropPercentage = { $gte: minDiscount };

    const sortOption: Record<string, 1 | -1> =
      sort === 'recent' ? { detectedAt: -1 } :
      sort === 'price' ? { currentPrice: 1 } :
      { dropPercentage: -1 };

    const [dealsList, total] = await Promise.all([
      Deal.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      Deal.countDocuments(filter),
    ]);

    return res.json({
      deals: dealsList.map(d => ({
        id: d._id,
        productTitle: d.productTitle,
        brand: d.brand,
        imageUrl: d.imageUrl,
        platform: d.platform,
        currentPrice: d.currentPrice,
        previousPrice: d.previousPrice,
        dropPercentage: d.dropPercentage,
        url: d.url,
        detectedAt: d.detectedAt,
        trackersCount: d.trackersCount,
      })),
      total,
      page,
      hasMore: skip + dealsList.length < total,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch deals', message: e.message });
  }
}

// --- Trending ---

async function trending(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectDB();

    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const category = req.query.category as string | undefined;

    const filter: Record<string, unknown> = {};
    if (category?.trim()) filter.category = category.trim();

    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const formatted = products.map((p: any) => ({
      id: p._id,
      title: p.title,
      brand: p.brand,
      imageUrl: p.imageUrl,
      price: p.price || 0,
      originalPrice: p.originalPrice,
      discount: p.discount,
      platform: p.platform || '',
      url: p.url || '',
    }));

    return res.json({ products: formatted });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch trending', message: e.message });
  }
}

export async function handleProducts(req: VercelRequest, res: VercelResponse, subpath: string) {
  switch (subpath) {
    case 'ai-recommend': return aiRecommend(req, res);
    case 'compare': return compare(req, res);
    case 'deals': return deals(req, res);
    case 'trending': return trending(req, res);
    default: return res.status(404).json({ error: 'Not found' });
  }
}
