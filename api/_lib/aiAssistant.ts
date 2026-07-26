/**
 * aiAssistant.ts
 *
 * AI Shopping Assistant — provider abstraction layer.
 *
 * ── Design ────────────────────────────────────────────────────────────────────
 * Supports Groq, OpenAI, and Gemini via a single interface.
 * Falls back gracefully when no AI keys are configured.
 * All inputs are sanitised before prompt construction to prevent injection.
 * API keys are NEVER returned to clients.
 *
 * ── Context ───────────────────────────────────────────────────────────────────
 * Builds context entirely from existing application data:
 *   - product metadata (title, brand, platform offers)
 *   - price history stats (lowest, highest, latest, firstSeen)
 *   - recommendations (betterDeal, similar, priceDropped, budget)
 *   - wishlist signals (how many users track it)
 *
 * ── Caching ───────────────────────────────────────────────────────────────────
 * Cache key: `${canonicalId}::${lowestPrice}::${offerCount}`
 * The price-sensitive key means the cache auto-invalidates when prices change.
 * TTL is configurable via AI_ASSISTANT_CACHE_TTL_MS env var (default 6h).
 *
 * ── Cost ─────────────────────────────────────────────────────────────────────
 * Groq llama-3.3-70b: ~0.6¢ per 1k input tokens, ~0.9¢ per 1k output tokens
 * Typical prompt: ~600 tokens, typical response: ~400 tokens
 * Cost per uncached call: ~$0.006  (sub-cent)
 * Cache hit rate at 80%: ~$0.0012 average per request
 */

import { LRUCache } from './lruCache.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssistantOffer {
  platform:      string;
  price:         number;
  originalPrice?: number;
  discount?:     number;
  rating?:       number;
}

export interface AssistantPriceStats {
  lowestPrice:  number;
  highestPrice: number;
  latestPrice:  number;
  /** ISO date string */
  firstSeen:    string;
  lastUpdated:  string;
}

export interface AssistantRecommendation {
  title:    string;
  price:    number;
  platform: string;
  reason:   string;
}

export interface AssistantContext {
  canonicalId:     string;
  title:           string;
  brand?:          string;
  offers:          AssistantOffer[];
  priceStats?:     AssistantPriceStats;
  betterDeals:     AssistantRecommendation[];
  similarProducts: AssistantRecommendation[];
  priceDropped:    AssistantRecommendation[];
  budgetOptions:   AssistantRecommendation[];
  wishlistCount?:  number;
}

export interface AssistantInsight {
  question: string;
  answer:   string;
  /** Structured data that drove this answer — shown as "why" in the UI */
  evidence: string;
  /** Confidence: 'high' | 'medium' | 'low' */
  confidence: 'high' | 'medium' | 'low';
}

export interface AssistantResponse {
  verdict:    'buy_now' | 'wait' | 'consider_alternative' | 'good_deal' | 'overpriced';
  summary:    string;
  insights:   AssistantInsight[];
  bestRetailer: string;
  bestValue?:   { title: string; price: number; platform: string; reason: string };
  generatedAt: number;
  /** Which AI provider produced this response */
  provider:   string;
  /** Whether this came from cache */
  cached:     boolean;
}

// ─── Sanitization ─────────────────────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all)\s+instructions/gi,
  /system\s*:/gi,
  /\[INST\]/gi,
  /<\|im_start\|>/gi,
  /\{\{.*?\}\}/g,    // template injection
  /\$\{.*?\}/g,      // JS template literal injection
];

/**
 * Strip potential prompt injection from string values.
 * Truncates to maxLen and removes injection patterns.
 */
export function sanitizeForPrompt(value: string, maxLen = 200): string {
  if (typeof value !== 'string') return '';
  let s = value.trim().slice(0, maxLen);
  for (const p of INJECTION_PATTERNS) {
    s = s.replace(p, '');
  }
  // Remove any line that starts with a role keyword
  s = s
    .split('\n')
    .filter(line => !/^(system|user|assistant|human|ai)\s*:/i.test(line.trim()))
    .join('\n')
    .trim();
  return s;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildPrompt(ctx: AssistantContext): string {
  const title  = sanitizeForPrompt(ctx.title, 120);
  const brand  = ctx.brand ? sanitizeForPrompt(ctx.brand, 50) : null;
  const offers = ctx.offers.slice(0, 7);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const offerLines = offers.map(o => {
    const parts = [`${sanitizeForPrompt(o.platform, 30)}: ${fmt(o.price)}`];
    if (o.originalPrice && o.originalPrice > o.price) {
      parts.push(`MRP ${fmt(o.originalPrice)}`);
      const realDisc = Math.round(((o.originalPrice - o.price) / o.originalPrice) * 100);
      parts.push(`${realDisc}% genuine discount`);
    }
    if (o.rating) parts.push(`${o.rating}★`);
    return `- ${parts.join(' | ')}`;
  }).join('\n');

  const historyLines = ctx.priceStats
    ? `Price history (last 90 days):
- Lowest ever: ${fmt(ctx.priceStats.lowestPrice)}
- Highest ever: ${fmt(ctx.priceStats.highestPrice)}
- Current: ${fmt(ctx.priceStats.latestPrice)}
- First seen: ${new Date(ctx.priceStats.firstSeen).toLocaleDateString('en-IN')}`
    : 'Price history: Not available';

  const betterLines = ctx.betterDeals.slice(0, 3).map(r =>
    `- ${sanitizeForPrompt(r.title, 60)} on ${sanitizeForPrompt(r.platform, 30)} at ${fmt(r.price)} — ${sanitizeForPrompt(r.reason, 80)}`
  ).join('\n') || 'None found';

  const droppedLines = ctx.priceDropped.slice(0, 3).map(r =>
    `- ${sanitizeForPrompt(r.title, 60)} dropped: ${sanitizeForPrompt(r.reason, 80)}`
  ).join('\n') || 'None found';

  const budgetLines = ctx.budgetOptions.slice(0, 3).map(r =>
    `- ${sanitizeForPrompt(r.title, 60)} at ${fmt(r.price)}: ${sanitizeForPrompt(r.reason, 80)}`
  ).join('\n') || 'None found';

  const wishlistNote = ctx.wishlistCount
    ? `Demand signal: ${ctx.wishlistCount} users are tracking this product's price.`
    : '';

  return `You are an AI shopping assistant for an Indian fashion price comparison platform called TagCheck.

Analyze this product and provide a shopping recommendation. Base ALL claims on the data below — never invent product quality claims.

## Product
Title: ${title}${brand ? `\nBrand: ${brand}` : ''}

## Current Prices Across Platforms
${offerLines}

## ${historyLines}

## Better Deals Available
${betterLines}

## Recently Price Dropped Alternatives
${droppedLines}

## Budget Alternatives
${budgetLines}

${wishlistNote}

## Your Task
Respond with ONLY valid JSON (no markdown, no code blocks, no backticks).

Determine:
1. Is the current price a good deal vs its own history?
2. Should the user buy now or wait?
3. Is there a cheaper genuine alternative?
4. Which retailer has the best real price (not just biggest discount badge)?
5. Has this product recently gotten cheaper?
6. Is the current discount % actually genuine (check if MRP is inflated)?
7. Which recommendation gives best value?

Required JSON structure:
{
  "verdict": "buy_now" | "wait" | "consider_alternative" | "good_deal" | "overpriced",
  "summary": "2-sentence decision summary with specific numbers",
  "insights": [
    {
      "question": "Is this a good deal?",
      "answer": "concrete yes/no answer with price context",
      "evidence": "the specific data point(s) that support this answer",
      "confidence": "high" | "medium" | "low"
    },
    {
      "question": "Should I buy now or wait?",
      "answer": "...",
      "evidence": "...",
      "confidence": "..."
    },
    {
      "question": "Is there a cheaper alternative?",
      "answer": "...",
      "evidence": "...",
      "confidence": "..."
    },
    {
      "question": "What is the best retailer?",
      "answer": "...",
      "evidence": "...",
      "confidence": "..."
    },
    {
      "question": "Has this product recently become cheaper?",
      "answer": "...",
      "evidence": "...",
      "confidence": "..."
    },
    {
      "question": "Is the current discount actually good?",
      "answer": "...",
      "evidence": "...",
      "confidence": "..."
    },
    {
      "question": "Which recommendation is the best value?",
      "answer": "...",
      "evidence": "...",
      "confidence": "..."
    }
  ],
  "bestRetailer": "platform name with lowest genuine price",
  "bestValue": {
    "title": "product title (or same product if it IS best value)",
    "price": 0,
    "platform": "platform name",
    "reason": "why this is best value in 1 sentence"
  }
}

Confidence rules:
- "high": strong data supports the answer (history available, multiple platform comparison)
- "medium": partial data, e.g. no history or only 1 platform
- "low": insufficient data to be certain

Do NOT answer "insufficient data" — always give the best answer possible from available data. Be specific about prices.`;
}

// ─── AI Provider Abstraction ──────────────────────────────────────────────────

export interface AIProvider {
  name: string;
  generate(prompt: string): Promise<string>;
  generateStream?(prompt: string): AsyncGenerator<string>;
}

/** Groq provider using the existing groq-sdk dependency */
function createGroqProvider(): AIProvider | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  return {
    name: 'groq',
    async generate(prompt: string): Promise<string> {
      const Groq = (await import('groq-sdk')).default;
      const client = new Groq({ apiKey: key });

      const completion = await new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Groq timeout')), 12000);
        client.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1200,
        }).then(r => { clearTimeout(timer); resolve(r); })
          .catch(e => { clearTimeout(timer); reject(e); });
      });

      return completion.choices[0]?.message?.content ?? '';
    },

    async *generateStream(prompt: string): AsyncGenerator<string> {
      const Groq = (await import('groq-sdk')).default;
      const client = new Groq({ apiKey: key });
      const stream = await client.chat.completions.create({
        model:       'llama-3.3-70b-versatile',
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens:  1200,
        stream:      true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
  };
}

/** OpenAI provider — optional, uses fetch directly to avoid extra dep */
function createOpenAIProvider(): AIProvider | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  return {
    name: 'openai',
    async generate(prompt: string): Promise<string> {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model:       'gpt-4o-mini',
          messages:    [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens:  1200,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
      const data = await res.json() as any;
      return data.choices?.[0]?.message?.content ?? '';
    },
  };
}

/** Gemini provider — uses Google's REST API */
function createGeminiProvider(): AIProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  return {
    name: 'gemini',
    async generate(prompt: string): Promise<string> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = await res.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    },
  };
}

/** Pick the first available provider in priority order: Groq → OpenAI → Gemini */
export function getProvider(): AIProvider | null {
  return createGroqProvider() ?? createOpenAIProvider() ?? createGeminiProvider();
}

// ─── Response parser ──────────────────────────────────────────────────────────

export function parseAssistantResponse(raw: string, provider: string): AssistantResponse | null {
  try {
    // Strip markdown code fences if model added them despite instructions
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/g, '')
      .trim();

    const data = JSON.parse(cleaned);

    const validVerdicts = new Set(['buy_now', 'wait', 'consider_alternative', 'good_deal', 'overpriced']);
    if (!validVerdicts.has(data.verdict)) return null;

    const insights: AssistantInsight[] = (data.insights ?? [])
      .filter((i: any) => i?.question && i?.answer)
      .map((i: any) => ({
        question:   sanitizeForPrompt(String(i.question), 100),
        answer:     sanitizeForPrompt(String(i.answer), 300),
        evidence:   sanitizeForPrompt(String(i.evidence ?? ''), 200),
        confidence: ['high', 'medium', 'low'].includes(i.confidence) ? i.confidence : 'medium',
      }));

    return {
      verdict:     data.verdict,
      summary:     sanitizeForPrompt(String(data.summary ?? ''), 400),
      insights,
      bestRetailer: sanitizeForPrompt(String(data.bestRetailer ?? ''), 50),
      bestValue:   data.bestValue ? {
        title:    sanitizeForPrompt(String(data.bestValue.title ?? ''), 120),
        price:    Number(data.bestValue.price) || 0,
        platform: sanitizeForPrompt(String(data.bestValue.platform ?? ''), 30),
        reason:   sanitizeForPrompt(String(data.bestValue.reason ?? ''), 200),
      } : undefined,
      generatedAt: Date.now(),
      provider,
      cached: false,
    };
  } catch {
    return null;
  }
}

// ─── Deterministic fallback (no AI) ──────────────────────────────────────────

/**
 * Rule-based fallback when no AI provider is available.
 * Uses only arithmetic on the context data — no AI costs.
 */
export function buildFallbackResponse(ctx: AssistantContext): AssistantResponse {
  const offers = ctx.offers.slice().sort((a, b) => a.price - b.price);
  const cheapest = offers[0];
  const stats = ctx.priceStats;
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  // Is at or near historical low?
  const atHistoricalLow = stats
    ? cheapest.price <= stats.lowestPrice * 1.05
    : null;

  // Is the discount genuine? Compare against median MRP
  const mrps = offers.filter(o => o.originalPrice).map(o => o.originalPrice!).sort((a,b)=>a-b);
  const medianMrp = mrps.length ? mrps[Math.floor(mrps.length / 2)] : null;
  const inflatedDiscount = cheapest.originalPrice && medianMrp
    ? cheapest.originalPrice > medianMrp * 1.4
    : false;

  const priceDropped7d = stats
    ? cheapest.price < stats.highestPrice * 0.9
    : false;

  const hasBetterAlternative = ctx.betterDeals.length > 0 || ctx.budgetOptions.length > 0;
  const bestAlt = ctx.betterDeals[0] ?? ctx.budgetOptions[0];

  const verdict = hasBetterAlternative && bestAlt && bestAlt.price < cheapest.price * 0.85
    ? 'consider_alternative'
    : atHistoricalLow
    ? 'buy_now'
    : atHistoricalLow === false && stats
    ? 'wait'
    : 'good_deal';

  const insights: AssistantInsight[] = [
    {
      question:   'Is this a good deal?',
      answer:     atHistoricalLow
        ? `Yes — ${fmt(cheapest.price)} is at or near its historical low of ${fmt(stats!.lowestPrice)}.`
        : stats
        ? `Price is above the historical low of ${fmt(stats.lowestPrice)}. There may be room to wait.`
        : `Currently ${fmt(cheapest.price)} on ${cheapest.platform}. No history data available for comparison.`,
      evidence:   stats
        ? `Historical range: ${fmt(stats.lowestPrice)} – ${fmt(stats.highestPrice)}`
        : 'No price history available',
      confidence: stats ? 'high' : 'low',
    },
    {
      question:   'Should I buy now or wait?',
      answer:     atHistoricalLow
        ? 'Buy now — this is near the lowest price we have recorded.'
        : stats && cheapest.price > stats.lowestPrice * 1.15
        ? 'Consider waiting — price has been lower in the past.'
        : 'Decision is neutral — limited history to make a confident call.',
      evidence:   stats
        ? `Lowest recorded: ${fmt(stats.lowestPrice)}, current: ${fmt(cheapest.price)}`
        : 'Insufficient price history',
      confidence: stats ? 'medium' : 'low',
    },
    {
      question:   'Is there a cheaper alternative?',
      answer:     bestAlt
        ? `Yes — ${bestAlt.title} is available at ${fmt(bestAlt.price)} on ${bestAlt.platform}, saving ${fmt(cheapest.price - bestAlt.price)}.`
        : 'No cheaper alternatives found in the current product pool.',
      evidence:   bestAlt ? bestAlt.reason : 'No alternatives with lower price found',
      confidence: bestAlt ? 'high' : 'medium',
    },
    {
      question:   'What is the best retailer?',
      answer:     `${cheapest.platform} currently has the lowest price at ${fmt(cheapest.price)}.`,
      evidence:   `Compared ${offers.length} offer${offers.length !== 1 ? 's' : ''} across platforms`,
      confidence: offers.length >= 3 ? 'high' : 'medium',
    },
    {
      question:   'Has this product recently become cheaper?',
      answer:     priceDropped7d
        ? 'Yes — the current price is significantly below the tracked high, suggesting a recent drop.'
        : 'Price appears stable based on available history.',
      evidence:   stats
        ? `High: ${fmt(stats.highestPrice)}, current: ${fmt(cheapest.price)}`
        : 'No history available',
      confidence: stats ? 'medium' : 'low',
    },
    {
      question:   'Is the current discount actually good?',
      answer:     inflatedDiscount
        ? `Caution: the MRP appears inflated. The genuine discount is likely lower than the badge shows.`
        : cheapest.originalPrice && cheapest.originalPrice > cheapest.price
        ? `Discount appears genuine — MRP (${fmt(cheapest.originalPrice)}) is consistent across platforms.`
        : 'No MRP data to assess discount authenticity.',
      evidence:   medianMrp
        ? `Median MRP across platforms: ${fmt(medianMrp)}`
        : 'No MRP comparison available',
      confidence: medianMrp ? 'medium' : 'low',
    },
    {
      question:   'Which recommendation is the best value?',
      answer:     ctx.betterDeals[0]
        ? `${ctx.betterDeals[0].title} on ${ctx.betterDeals[0].platform} at ${fmt(ctx.betterDeals[0].price)} — ${ctx.betterDeals[0].reason}`
        : 'The current product on ' + cheapest.platform + ' is the best value found.',
      evidence:   ctx.betterDeals[0]?.reason ?? 'Based on current platform comparison',
      confidence: ctx.betterDeals.length > 0 ? 'medium' : 'low',
    },
  ];

  return {
    verdict,
    summary: `${cheapest.platform} has the best price at ${fmt(cheapest.price)}. ${
      atHistoricalLow ? 'This is near the historical low — good time to buy.'
        : stats ? 'Price has been lower. Consider waiting or checking alternatives.'
        : 'Limited history available.'
    }`,
    insights,
    bestRetailer: cheapest.platform,
    bestValue: bestAlt ? {
      title:    bestAlt.title,
      price:    bestAlt.price,
      platform: bestAlt.platform,
      reason:   bestAlt.reason,
    } : undefined,
    generatedAt: Date.now(),
    provider:    'rule-based',
    cached:      false,
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const AI_CACHE_TTL_MS =
  Number(process.env.AI_ASSISTANT_CACHE_TTL_MS) || 6 * 60 * 60 * 1000; // 6h default

// Bounded LRU — max 200 entries; one per (product × price snapshot)
const responseCache = new LRUCache<string, AssistantResponse>({
  maxSize: 200,
  ttlMs:   AI_CACHE_TTL_MS,
});

export function getCacheKey(ctx: AssistantContext): string {
  const lowestPrice = Math.min(...ctx.offers.map(o => o.price), Infinity);
  return `${ctx.canonicalId}::${lowestPrice}::${ctx.offers.length}`;
}

export function getCachedResponse(ctx: AssistantContext): AssistantResponse | null {
  const key = getCacheKey(ctx);
  const hit = responseCache.get(key);
  if (!hit) return null;
  return { ...hit, cached: true };
}

export function setCachedResponse(ctx: AssistantContext, response: AssistantResponse): void {
  responseCache.set(getCacheKey(ctx), { ...response, cached: false });
}

/** Exposed for test reset. */
export function clearAssistantCache(): void {
  responseCache.clear();
}

export { responseCache as _assistantCache };

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generate an AI shopping assistant response for a product.
 * Returns a cached response if available.
 * Falls back to rule-based analysis if no AI provider is configured.
 */
export async function generateAssistantResponse(
  ctx: AssistantContext,
): Promise<AssistantResponse> {
  // Cache check
  const cached = getCachedResponse(ctx);
  if (cached) return cached;

  const provider = getProvider();

  // No AI provider — use deterministic rule-based fallback
  if (!provider) {
    const fallback = buildFallbackResponse(ctx);
    setCachedResponse(ctx, fallback);
    return fallback;
  }

  try {
    const prompt = buildPrompt(ctx);
    const raw    = await provider.generate(prompt);
    const parsed = parseAssistantResponse(raw, provider.name);

    if (!parsed) {
      // Parse failure — fall back to rule-based
      const fallback = buildFallbackResponse(ctx);
      fallback.provider = `${provider.name}-fallback`;
      setCachedResponse(ctx, fallback);
      return fallback;
    }

    setCachedResponse(ctx, parsed);
    return parsed;
  } catch (e: any) {
    console.error('[aiAssistant] generation error:', e?.message?.slice(0, 100));
    const fallback = buildFallbackResponse(ctx);
    fallback.provider = 'rule-based-error-fallback';
    // Don't cache error fallbacks — try AI again next request
    return fallback;
  }
}
