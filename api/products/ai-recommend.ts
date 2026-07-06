import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

/**
 * Generate AI shopping recommendation for a product comparison.
 * Returns structured JSON with summary, pros, cons, recommendation, bestPlatform, confidence.
 * Has a 5-second timeout — returns empty object on timeout or failure.
 * Accepts priceHistory in request body for future use.
 * NEVER returns 500 — always 200 with fallback data.
 */

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { productTitle, platforms, priceHistory: _priceHistory } = req.body || {};
    if (!productTitle) return res.status(400).json({ error: 'productTitle is required' });

    // If no Groq key, return a basic recommendation
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
      5000 // 5-second timeout
    );

    const raw = completion.choices[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    const result = JSON.parse(cleaned) as AIRecommendation;

    // Ensure confidence field exists
    if (typeof result.confidence !== 'number') {
      result.confidence = 0.7;
    }

    return res.json(result);
  } catch {
    // Never throw 500 — return empty response on any failure (including timeout)
    return res.json(EMPTY_RESPONSE);
  }
}
