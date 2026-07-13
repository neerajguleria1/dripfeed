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
  /** true only when this came from the real Groq model call. */
  isAiGenerated?: boolean;
}

const EMPTY_RESPONSE: AIRecommendation = {
  summary: '',
  pros: [],
  cons: [],
  recommendation: '',
  bestPlatform: null,
  confidence: 0,
  isAiGenerated: false,
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

    // Rule-based check (not AI): flag platforms whose discount % looks inflated
    // by an artificially high MRP — a common Indian e-commerce tactic where a
    // "70% off" badge is calculated against a price nobody ever actually paid.
    // We flag when a platform's MRP is >40% above the median MRP across all
    // platforms for the same product — a real signal price alone can't show.
    const mrps = (platforms || [])
      .map((p: any) => p.originalPrice)
      .filter((v: any) => typeof v === 'number' && v > 0)
      .sort((a: number, b: number) => a - b);
    const medianMrp = mrps.length ? mrps[Math.floor(mrps.length / 2)] : null;
    const inflatedDiscountPlatforms = (platforms || [])
      .filter((p: any) => medianMrp && p.originalPrice && p.originalPrice > medianMrp * 1.4)
      .map((p: any) => p.platform);

    if (!process.env.GROQ_API_KEY) {
      const sorted = (platforms || []).slice().sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
      const cheapest = sorted[0];
      const cons = ['Prices may change', 'Stock availability varies'];
      if (inflatedDiscountPlatforms.length) {
        cons.push(`Watch out: ${inflatedDiscountPlatforms.join(', ')} may show an inflated discount %`);
      }
      return res.json({
        summary: `Comparing ${productTitle} across ${platforms?.length || 0} platforms.`,
        pros: ['Multiple options available', 'Price comparison saves money'],
        cons,
        recommendation: cheapest ? `Buy from ${cheapest.platform} for the lowest price.` : 'Compare prices before buying.',
        bestPlatform: cheapest?.platform || null,
        confidence: 0.5,
        isAiGenerated: false,
      } satisfies AIRecommendation);
    }

    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const priceList = (platforms || [])
      .filter((p: any) => p.price)
      .map((p: any) => {
        const parts = [`${p.platform}: ₹${p.price.toLocaleString('en-IN')}`];
        if (p.originalPrice) parts.push(`MRP ₹${p.originalPrice.toLocaleString('en-IN')}`);
        if (p.discount) parts.push(`${p.discount}% off`);
        if (p.rating) parts.push(`${p.rating}★ rating`);
        return `- ${parts.join(', ')}`;
      })
      .join('\n');

    const brandLine = platforms?.find((p: any) => p.brand)?.brand
      ? `Brand: ${platforms.find((p: any) => p.brand).brand}\n`
      : '';

    const flagLine = inflatedDiscountPlatforms.length
      ? `\nData flag (verified, not a guess): ${inflatedDiscountPlatforms.join(', ')} shows a discount % calculated against an MRP significantly higher than other platforms for the same product — the displayed discount may be inflated. Mention this directly in your cons if relevant.\n`
      : '';

    const prompt = `Analyze this product for an Indian shopper. Base your pros/cons ONLY on the data given below — do not invent product quality claims you have no evidence for.

Product: ${productTitle}
${brandLine}
Prices across platforms:
${priceList || 'No price data available.'}
${flagLine}
Return ONLY valid JSON (no markdown, no backticks):
{
  "summary": "2-sentence overview grounded in the price/rating data above, not invented product claims",
  "pros": ["pro1", "pro2", "pro3"],
  "cons": ["con1", "con2"],
  "recommendation": "brief buy/wait advice in 1 sentence, based on price spread and any discount flags",
  "bestPlatform": "platform name with best value (lowest genuine price, factoring in any inflated-discount flag) or null",
  "confidence": 0.85
}

confidence should be a number between 0 and 1 indicating how confident you are in the recommendation. Lower confidence if data is sparse (e.g. only 1-2 platforms or no ratings available).`;

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
    result.isAiGenerated = true;

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
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const parts = parsed.pathname.split('/').filter(Boolean);
        let productName = '';

        if (host.includes('amazon')) {
          const kParam = parsed.searchParams.get('k');
          if (kParam) { productName = kParam; }
          else {
            const dpIdx = parts.indexOf('dp');
            if (dpIdx > 0) productName = parts[dpIdx - 1].replace(/[-_]/g, ' ').trim();
            else if (dpIdx === 0 && parts[1]) {
              // /dp/ASIN — look up ASIN directly via structured API
              const { searchProducts: sp } = await import('../search.js');
              const asin = parts[1];
              const r = await sp(asin);
              if (r.length > 0) {
                const sorted = r.sort((a, b) => a.price - b.price);
                return res.json({ platforms: sorted, products: sorted, query: sorted[0].title, sourceUrl: url });
              }
              productName = asin;
            }
            else productName = parts[0]?.replace(/[-_]/g, ' ').trim() || '';
          }
        } else if (host.includes('flipkart')) {
          const pIdx = parts.indexOf('p');
          const slug = pIdx > 0 ? parts[pIdx - 1] : parts[0] || '';
          productName = slug.replace(/[-_]/g, ' ').replace(/\b(itm\w+)\b/gi, '').trim();
        } else if (host.includes('myntra')) {
          // Pick longest non-numeric segment
          productName = parts
            .filter(p => !/^\d+$/.test(p) && p !== 'buy' && p.length > 3)
            .sort((a, b) => b.length - a.length)[0]?.replace(/[-_]/g, ' ').trim() || '';
        } else if (host.includes('ajio')) {
          productName = parts
            .filter(p => p !== 'p' && p !== 's' && p.length > 3 && !/^[A-Z0-9]{8,}$/.test(p))
            .sort((a, b) => b.length - a.length)[0]?.replace(/[-_]/g, ' ').replace(/\d{4,}/g, '').trim() || '';
        } else if (host.includes('meesho') || host.includes('nykaa') || host.includes('tatacliq')) {
          const pIdx = parts.indexOf('p');
          const slug = pIdx > 0 ? parts[pIdx - 1] : parts[0] || '';
          productName = slug.replace(/[-_]/g, ' ').trim();
        } else {
          productName = parts
            .filter(p => p.length > 3 && !/^\d+$/.test(p) && !['p', 'dp', 'buy', 'itm', 'search'].includes(p))
            .sort((a, b) => b.length - a.length)[0]?.replace(/[-_]/g, ' ').trim() || '';
        }

        const { searchProducts, slugToSearchQuery } = await import('../search.js');
        const cleanedName = slugToSearchQuery(productName);

        if (!cleanedName || cleanedName.length < 3) {
          return res.status(400).json({ error: 'Could not extract product name from URL. Try searching by product name instead.' });
        }

        const results = await searchProducts(cleanedName);
        const sorted = results.sort((a, b) => a.price - b.price);

        return res.json({
          platforms: sorted,
          products: sorted,
          query: cleanedName,
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
