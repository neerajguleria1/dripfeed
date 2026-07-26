/**
 * queryInterpreter.ts
 *
 * AI-powered Search Query Interpreter.
 * Converts natural language queries into structured search filters.
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 *   1. Rule-based parser   — deterministic, zero cost, handles common patterns
 *   2. AI layer (optional) — Groq → OpenAI → Gemini fallback chain
 *   3. LRU cache           — keyed by normalised query text, configurable TTL
 *
 * ── Design choices ───────────────────────────────────────────────────────────
 *   - Rule-based handles ~80% of queries with zero latency / cost.
 *   - AI only fires for queries the rules can't parse with high confidence.
 *   - The existing search pipeline is NEVER modified; filters are applied
 *     client-side against whatever the search engine returns.
 *   - Prompt injection is prevented by sanitising all user input before
 *     interpolation.
 */

import { LRUCache } from './lruCache.js';
import { sanitizeForPrompt } from './aiAssistant.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedQuery {
  /** The normalised keyword string to pass to the search engine */
  searchKeywords: string;
  /** Structured filter fields extracted from the query */
  filters: InterpretedFilters;
  /** 0–1 confidence that the parse is correct */
  confidence: number;
  /** Which method produced this: 'rules' | 'groq' | 'openai' | 'gemini' | 'fallback' */
  provider: 'rules' | 'groq' | 'openai' | 'gemini' | 'fallback';
  /** true if served from cache */
  cached: boolean;
}

export interface InterpretedFilters {
  category?:         string;
  brand?:            string;
  color?:            string;
  size?:             string;
  gender?:           'men' | 'women' | 'kids' | 'unisex';
  style?:            string;
  minPrice?:         number;
  maxPrice?:         number;
  minDiscount?:      number;
  retailer?:         string;
  sort?:             'price-asc' | 'price-desc' | 'discount-desc' | 'relevance';
  comparisonIntent?: boolean;
}

/** A single removable filter token shown in the UI */
export interface FilterChip {
  key:   keyof InterpretedFilters;
  label: string;
  value: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = Number(process.env.QUERY_INTERPRETER_CACHE_TTL_MS) || 30 * 60 * 1000; // 30 min
const MAX_CACHE = 500;

/** Minimum rule-based confidence to skip AI entirely */
const RULE_CONFIDENCE_THRESHOLD = 0.55;

const KNOWN_BRANDS = new Set([
  'nike', 'adidas', 'puma', 'reebok', 'levis', "levi's", 'h&m', 'zara', 'only', 'vero moda',
  'mango', 'forever 21', 'forever21', 'roadster', 'hrx', 'here&now', 'w', 'biba', 'libas',
  'antheaa', 'global desi', 'nykd', 'clovia', 'jockey', 'peter england', 'van heusen',
  'allen solly', 'arrow', 'louis philippe', 'us polo', 'u.s. polo', 'jack & jones',
  'jack&jones', 'selected homme', 'calvin klein', 'tommy hilfiger', 'lacoste', 'fastrack',
  'titan', 'fossil', 'casio', 'woodland', 'red tape', 'bata', 'liberty', 'metro shoes',
  'samsung', 'apple', 'oneplus', 'realme', 'xiaomi', 'mi', 'redmi', 'oppo', 'vivo', 'poco',
  'iqoo', 'nothing', 'motorola', 'lg', 'sony', 'hp', 'dell', 'lenovo', 'asus', 'acer',
  'boat', 'jbl', 'sennheiser', 'skullcandy', 'noise',
]);

const KNOWN_RETAILERS = new Set([
  'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tatacliq', 'tata cliq',
  'nykaa fashion', 'nykaafashion', 'bewakoof',
]);

const COLOR_MAP: Record<string, string> = {
  black: 'black', white: 'white', red: 'red', blue: 'blue', navy: 'navy',
  green: 'green', yellow: 'yellow', orange: 'orange', pink: 'pink',
  purple: 'purple', grey: 'grey', gray: 'grey', brown: 'brown',
  beige: 'beige', cream: 'cream', off_white: 'off-white', 'off-white': 'off-white',
  maroon: 'maroon', olive: 'olive', mustard: 'mustard', teal: 'teal', coral: 'coral',
  peach: 'peach', lavender: 'lavender', wine: 'wine', rust: 'rust', khaki: 'khaki',
  turquoise: 'turquoise', magenta: 'magenta', indigo: 'indigo', multicolor: 'multicolor',
  printed: 'printed', floral: 'floral',
};

const SIZE_PATTERN = /\b(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|xL|4xl|free\s*size|one\s*size)\b/i;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Tops
  'kurta': ['kurta', 'kurti', 'kurtis'],
  'shirt': ['shirt', 'shirts'],
  'top': ['top', 'tops', 'crop top', 'croptop'],
  'blouse': ['blouse'],
  'saree': ['saree', 'sari', 'sarees'],
  'lehenga': ['lehenga', 'lehanga'],
  'suit': ['suit', 'suits', 'salwar suit', 'salwar kameez', 'sharara', 'palazzo suit'],
  'dress': ['dress', 'dresses', 'maxi dress', 'midi dress', 'mini dress'],
  'gown': ['gown', 'gowns'],
  // Bottoms
  'jeans': ['jeans', 'denim', 'denims'],
  'trouser': ['trouser', 'trousers', 'pant', 'pants'],
  'shorts': ['shorts'],
  'skirt': ['skirt', 'skirts'],
  'palazzo': ['palazzo'],
  'leggings': ['leggings', 'jeggings'],
  // Outerwear
  'hoodie': ['hoodie', 'hoody', 'sweatshirt', 'sweat shirt'],
  'jacket': ['jacket', 'jackets', 'bomber', 'windbreaker'],
  'sweater': ['sweater', 'jumper', 'pullover', 'cardigan'],
  'coat': ['coat', 'overcoat'],
  // Footwear
  'sneakers': ['sneaker', 'sneakers', 'trainer', 'trainers', 'running shoes'],
  'heels': ['heel', 'heels', 'stiletto', 'wedge'],
  'sandals': ['sandal', 'sandals', 'slipper', 'slippers', 'flip flops'],
  'boots': ['boot', 'boots', 'ankle boot'],
  'loafers': ['loafer', 'loafers', 'moccasin'],
  'flats': ['flat', 'flats', 'ballerina'],
  'shoes': ['shoe', 'shoes', 'footwear'],
  // Accessories
  'watch': ['watch', 'watches'],
  'bag': ['bag', 'bags', 'handbag', 'purse', 'tote', 'clutch', 'backpack'],
  'sunglasses': ['sunglass', 'sunglasses', 'eyewear'],
  'jewellery': ['jewellery', 'jewelry', 'necklace', 'earring', 'bracelet', 'ring', 'bangles'],
  // Electronics
  'phone': ['phone', 'mobile', 'smartphone', 'iphone'],
  'laptop': ['laptop', 'notebook'],
  'earphones': ['earphone', 'earphones', 'earbuds', 'headphone', 'headphones', 'tws'],
  'tablet': ['tablet', 'ipad'],
};

const GENDER_MAP: Record<string, 'men' | 'women' | 'kids' | 'unisex'> = {
  men: 'men', man: 'men', male: 'men', boys: 'men', boy: 'men', mens: 'men',
  women: 'women', woman: 'women', female: 'women', girls: 'women', girl: 'women', ladies: 'women', womens: 'women',
  kids: 'kids', children: 'kids', child: 'kids', baby: 'kids', toddler: 'kids',
  unisex: 'unisex',
};

const STYLE_KEYWORDS: Record<string, string> = {
  oversized: 'oversized', baggy: 'oversized', loose: 'loose', slim: 'slim fit',
  'slim fit': 'slim fit', skinny: 'skinny', regular: 'regular', fitted: 'fitted',
  straight: 'straight fit', flared: 'flared', bootcut: 'bootcut', tapered: 'tapered',
  ethnic: 'ethnic', traditional: 'ethnic', indo: 'indo-western', fusion: 'fusion',
  casual: 'casual', formal: 'formal', party: 'party wear', office: 'formal',
  western: 'western', printed: 'printed', floral: 'floral', embroidered: 'embroidered',
  plain: 'plain', solid: 'solid', striped: 'striped', checkered: 'checkered',
  graphic: 'graphic', vintage: 'vintage', boho: 'boho', bohemian: 'boho',
  athleisure: 'athleisure', sporty: 'sporty', activewear: 'activewear',
};

// ─── LRU Cache ────────────────────────────────────────────────────────────────

const interpreterCache = new LRUCache<string, ParsedQuery>({
  maxSize: MAX_CACHE,
  ttlMs:   CACHE_TTL_MS,
});

export function _clearInterpreterCache() { interpreterCache.clear(); }
export { interpreterCache as _interpreterCache };

// ─── Normaliser ───────────────────────────────────────────────────────────────

export function normaliseQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Rule-based parser ────────────────────────────────────────────────────────

/**
 * Deterministic rule-based extraction.
 * Returns ParsedQuery with provider='rules'.
 * Confidence is based on how many signals were found.
 */
export function parseQueryWithRules(raw: string): ParsedQuery {
  const q     = normaliseQuery(raw);
  const words = q.split(/\s+/);
  const filters: InterpretedFilters = {};
  let extracted: string[] = [];  // tokens consumed by extraction (to remove from keyword string)
  let signals = 0;               // count of successfully extracted signals

  // ── 1. Price range ────────────────────────────────────────────────────────
  // "under 2000", "below 1500", "less than 3000", "upto 500", "up to 500"
  const underMatch = q.match(/\b(?:under|below|less\s+than|upto|up\s+to|within|max|maximum)\s*₹?\s*(\d[\d,]*)/i);
  if (underMatch) {
    filters.maxPrice = parseInt(underMatch[1].replace(/,/g, ''), 10);
    extracted.push(underMatch[0]);
    signals++;
  }
  // "above 1000", "over 500", "more than 2000", "min 500", "at least 300"
  const aboveMatch = q.match(/\b(?:above|over|more\s+than|min(?:imum)?|at\s+least|starting\s+(?:from|at))\s*₹?\s*(\d[\d,]*)/i);
  if (aboveMatch) {
    filters.minPrice = parseInt(aboveMatch[1].replace(/,/g, ''), 10);
    extracted.push(aboveMatch[0]);
    signals++;
  }
  // "between 500 and 2000", "500 to 2000", "₹500-₹2000"
  const rangeMatch = q.match(/(?:between\s+)?₹?\s*(\d[\d,]*)\s*(?:to|-|and)\s*₹?\s*(\d[\d,]*)/i);
  if (rangeMatch && !underMatch && !aboveMatch) {
    filters.minPrice = parseInt(rangeMatch[1].replace(/,/g, ''), 10);
    filters.maxPrice = parseInt(rangeMatch[2].replace(/,/g, ''), 10);
    extracted.push(rangeMatch[0]);
    signals++;
  }

  // ── 2. Discount intent ────────────────────────────────────────────────────
  const discountMatch = q.match(/\b(\d{1,2})\s*%?\s*(?:off|discount|sale)/i)
    ?? q.match(/(?:sale|discount|clearance|offer|deals?)\b/i);
  if (discountMatch?.[1]) {
    filters.minDiscount = parseInt(discountMatch[1], 10);
    extracted.push(discountMatch[0]);
    signals++;
  } else if (discountMatch) {
    filters.minDiscount = 10; // generic "sale" → ≥10% off
    extracted.push(discountMatch[0]);
    signals++;
  }

  // ── 3. Sort intent ────────────────────────────────────────────────────────
  if (/\b(?:cheapest|lowest\s+price|price\s+low\s+to\s+high|budget)\b/i.test(q)) {
    filters.sort = 'price-asc';
    signals++;
  } else if (/\b(?:expensive|highest\s+price|most\s+expensive|premium|luxury)\b/i.test(q)) {
    filters.sort = 'price-desc';
    signals++;
  } else if (/\b(?:best\s+discount|highest\s+discount|most\s+discount|sale)\b/i.test(q)) {
    filters.sort = 'discount-desc';
    signals++;
  }

  // ── 4. Retailer preference ────────────────────────────────────────────────
  for (const retailer of KNOWN_RETAILERS) {
    const re = new RegExp(`\\b${retailer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(q)) {
      filters.retailer = retailer;
      extracted.push(retailer);
      signals++;
      break;
    }
  }

  // ── 5. Comparison intent ──────────────────────────────────────────────────
  if (/\b(?:compare|comparison|vs|versus|which\s+is\s+better)\b/i.test(q)) {
    filters.comparisonIntent = true;
    signals++;
  }

  // ── 6. Brand ──────────────────────────────────────────────────────────────
  for (const brand of KNOWN_BRANDS) {
    const re = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(q)) {
      filters.brand = brand;
      extracted.push(brand);
      signals++;
      break;
    }
  }

  // ── 7. Gender ─────────────────────────────────────────────────────────────
  for (const [kw, gender] of Object.entries(GENDER_MAP)) {
    if (words.includes(kw)) {
      filters.gender = gender;
      extracted.push(kw);
      signals++;
      break;
    }
  }

  // ── 8. Color ─────────────────────────────────────────────────────────────
  // Use word-boundary regex and pick the earliest + longest match to handle
  // "navy blue" → navy (not blue), "mustard yellow" → mustard (not yellow)
  {
    let bestColor: string | null = null;
    let bestIdx = Infinity;
    let bestLen = 0;
    for (const [kw, color] of Object.entries(COLOR_MAP)) {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      const match = re.exec(q);
      if (match) {
        const idx = match.index;
        const len = kw.length;
        // Prefer: longer match > earlier in string
        if (len > bestLen || (len === bestLen && idx < bestIdx)) {
          bestColor = color;
          bestIdx = idx;
          bestLen = len;
        }
      }
    }
    if (bestColor) {
      filters.color = bestColor;
      // Find the original token for removal (the key that produced this color)
      const matchingKw = Object.entries(COLOR_MAP).find(([, v]) => v === bestColor)?.[0] ?? bestColor;
      extracted.push(matchingKw);
      signals++;
    }
  }

  // ── 9. Size ───────────────────────────────────────────────────────────────
  const sizeMatch = q.match(SIZE_PATTERN);
  if (sizeMatch) {
    filters.size = sizeMatch[0].replace(/\s+/g, '').toUpperCase().replace('FREELSIZE', 'Free Size');
    extracted.push(sizeMatch[0]);
    signals++;
  }

  // ── 10. Style ─────────────────────────────────────────────────────────────
  for (const [kw, style] of Object.entries(STYLE_KEYWORDS)) {
    if (q.includes(kw)) {
      // Don't add styles that conflict with already-extracted category
      if (!filters.category || !filters.category.toLowerCase().includes(kw)) {
        filters.style = style;
        signals++;
        break;
      }
    }
  }

  // ── 11. Category ─────────────────────────────────────────────────────────
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => {
      const re = new RegExp(`\\b${kw}\\b`, 'i');
      return re.test(q);
    })) {
      filters.category = cat;
      signals++;
      break;
    }
  }

  // ── Build clean keyword string ─────────────────────────────────────────────
  // Remove extracted tokens from query to produce a clean search keyword string
  let keywords = q;
  for (const token of extracted) {
    keywords = keywords.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  // Also strip filter keywords that are now captured in filters object
  if (filters.color) keywords = keywords.replace(new RegExp(`\\b${filters.color}\\b`, 'gi'), ' ');
  if (filters.size) keywords = keywords.replace(new RegExp(`\\b${filters.size}\\b`, 'gi'), ' ');
  if (filters.gender) {
    keywords = keywords.replace(new RegExp(`\\b(${Object.keys(GENDER_MAP).join('|')})\\b`, 'gi'), ' ');
  }
  if (filters.style) {
    const matchingKw = Object.entries(STYLE_KEYWORDS).find(([, v]) => v === filters.style)?.[0] ?? '';
    if (matchingKw) keywords = keywords.replace(new RegExp(`\\b${matchingKw}\\b`, 'gi'), ' ');
  }
  keywords = keywords.replace(/\s+/g, ' ').trim();

  // Confidence: 0 signals = pure keyword; ≥3 signals = high confidence
  const confidence = signals === 0 ? 0.2 :
    signals === 1 ? 0.45 :
    signals === 2 ? 0.6 :
    signals === 3 ? 0.75 :
    Math.min(0.95, 0.75 + (signals - 3) * 0.05);

  return {
    searchKeywords: keywords || raw.trim(),
    filters,
    confidence,
    provider: 'rules',
    cached: false,
  };
}

// ─── AI Prompt ────────────────────────────────────────────────────────────────

export function buildInterpreterPrompt(query: string): string {
  const safe = sanitizeForPrompt(query, 150);
  return `You are a search query parser for an Indian fashion and electronics price comparison platform.

Parse the following search query and extract structured filters. Return ONLY valid JSON with no markdown.

Query: "${safe}"

Extract these fields (all optional, omit if not present):
- category: product type (e.g. "kurta", "jeans", "sneakers", "hoodie", "phone", "laptop")
- brand: brand name if mentioned (e.g. "Nike", "Samsung", "Levi's")
- color: color if mentioned (lowercase, e.g. "black", "navy", "olive")
- size: clothing/shoe size if mentioned (e.g. "M", "L", "XL", "42")
- gender: "men" | "women" | "kids" | "unisex" if mentioned
- style: fit/style descriptor if mentioned (e.g. "oversized", "slim fit", "ethnic", "formal")
- minPrice: minimum price in INR as integer (e.g. 500)
- maxPrice: maximum price in INR as integer (e.g. 2000)
- minDiscount: minimum discount percentage as integer (e.g. 30)
- retailer: specific retailer if mentioned (e.g. "myntra", "flipkart")
- sort: "price-asc" | "price-desc" | "discount-desc" | "relevance"
- comparisonIntent: true if user wants to compare products
- searchKeywords: the remaining keywords after removing all extracted filter terms

Return exactly this JSON structure (omit fields not found):
{
  "searchKeywords": "...",
  "filters": {
    "category": "...",
    "brand": "...",
    "color": "...",
    "size": "...",
    "gender": "...",
    "style": "...",
    "minPrice": 0,
    "maxPrice": 0,
    "minDiscount": 0,
    "retailer": "...",
    "sort": "...",
    "comparisonIntent": false
  },
  "confidence": 0.9
}

Examples:
- "black oversized hoodie under 2000" → searchKeywords: "hoodie", filters: {category:"hoodie", color:"black", style:"oversized", maxPrice:2000}, confidence:0.95
- "nike running shoes for men size 10" → searchKeywords: "running shoes", filters: {brand:"nike", category:"shoes", gender:"men", size:"10"}, confidence:0.9
- "cheapest sarees on myntra" → searchKeywords: "sarees", filters: {category:"saree", retailer:"myntra", sort:"price-asc"}, confidence:0.9`;
}

// ─── AI Provider (reuses pattern from aiAssistant.ts) ────────────────────────

async function callGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('no groq key');
  const Groq = (await import('groq-sdk')).default;
  const client = new Groq({ apiKey: key });
  const completion = await Promise.race([
    client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 400,
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
  ]) as any;
  return completion.choices?.[0]?.message?.content ?? '';
}

async function callOpenAI(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('no openai key');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 400 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('no gemini key');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 400 } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callAI(prompt: string): Promise<{ text: string; provider: 'groq' | 'openai' | 'gemini' }> {
  if (process.env.GROQ_API_KEY) {
    try { return { text: await callGroq(prompt), provider: 'groq' }; } catch { /* fall through */ }
  }
  if (process.env.OPENAI_API_KEY) {
    try { return { text: await callOpenAI(prompt), provider: 'openai' }; } catch { /* fall through */ }
  }
  if (process.env.GEMINI_API_KEY) {
    try { return { text: await callGemini(prompt), provider: 'gemini' }; } catch { /* fall through */ }
  }
  throw new Error('no AI provider available');
}

// ─── AI response parser ───────────────────────────────────────────────────────

export function parseAIResponse(raw: string, originalQuery: string): ParsedQuery | null {
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    const data = JSON.parse(cleaned);
    const filters: InterpretedFilters = {};
    const f = data.filters ?? data; // some models hoist fields to top level

    if (typeof f.category === 'string' && f.category.trim()) filters.category = sanitizeForPrompt(f.category, 50).toLowerCase();
    if (typeof f.brand === 'string' && f.brand.trim()) filters.brand = sanitizeForPrompt(f.brand, 50);
    if (typeof f.color === 'string' && f.color.trim()) filters.color = sanitizeForPrompt(f.color, 30).toLowerCase();
    if (typeof f.size === 'string' && f.size.trim()) filters.size = sanitizeForPrompt(f.size, 10);
    if (['men', 'women', 'kids', 'unisex'].includes(f.gender)) filters.gender = f.gender;
    if (typeof f.style === 'string' && f.style.trim()) filters.style = sanitizeForPrompt(f.style, 50).toLowerCase();
    if (typeof f.minPrice === 'number' && f.minPrice > 0) filters.minPrice = Math.round(f.minPrice);
    if (typeof f.maxPrice === 'number' && f.maxPrice > 0) filters.maxPrice = Math.round(f.maxPrice);
    if (typeof f.minDiscount === 'number' && f.minDiscount > 0) filters.minDiscount = Math.round(f.minDiscount);
    if (typeof f.retailer === 'string' && f.retailer.trim()) filters.retailer = sanitizeForPrompt(f.retailer, 30).toLowerCase();
    if (['price-asc','price-desc','discount-desc','relevance'].includes(f.sort)) filters.sort = f.sort;
    if (f.comparisonIntent === true) filters.comparisonIntent = true;

    const keywords = typeof data.searchKeywords === 'string' && data.searchKeywords.trim()
      ? sanitizeForPrompt(data.searchKeywords.trim(), 150)
      : originalQuery;

    const confidence = typeof data.confidence === 'number'
      ? Math.max(0, Math.min(1, data.confidence))
      : 0.75;

    return { searchKeywords: keywords, filters, confidence, provider: 'fallback', cached: false };
  } catch {
    return null;
  }
}

// ─── Filter chip builder ──────────────────────────────────────────────────────

/** Converts an InterpretedFilters object into removable UI chips */
export function buildFilterChips(filters: InterpretedFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  if (filters.category)         chips.push({ key: 'category',         label: 'Category',  value: filters.category });
  if (filters.brand)            chips.push({ key: 'brand',            label: 'Brand',     value: filters.brand });
  if (filters.color)            chips.push({ key: 'color',            label: 'Color',     value: filters.color });
  if (filters.size)             chips.push({ key: 'size',             label: 'Size',      value: filters.size });
  if (filters.gender)           chips.push({ key: 'gender',           label: 'Gender',    value: filters.gender });
  if (filters.style)            chips.push({ key: 'style',            label: 'Style',     value: filters.style });
  if (filters.retailer)         chips.push({ key: 'retailer',         label: 'Retailer',  value: filters.retailer });
  if (filters.minDiscount)      chips.push({ key: 'minDiscount',      label: 'Discount',  value: `${filters.minDiscount}%+` });
  if (filters.sort && filters.sort !== 'relevance') {
    const sortLabels: Record<string, string> = { 'price-asc': 'Price: Low to High', 'price-desc': 'Price: High to Low', 'discount-desc': 'Highest Discount' };
    chips.push({ key: 'sort', label: 'Sort', value: sortLabels[filters.sort] ?? filters.sort });
  }
  if (filters.comparisonIntent) chips.push({ key: 'comparisonIntent', label: 'Intent',   value: 'Compare' });
  if (filters.minPrice && filters.maxPrice) {
    chips.push({ key: 'minPrice', label: 'Price', value: `${fmt(filters.minPrice)} – ${fmt(filters.maxPrice)}` });
  } else if (filters.minPrice) {
    chips.push({ key: 'minPrice', label: 'Min Price', value: `${fmt(filters.minPrice)}+` });
  } else if (filters.maxPrice) {
    chips.push({ key: 'maxPrice', label: 'Max Price', value: `Under ${fmt(filters.maxPrice)}` });
  }

  return chips;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Interpret a natural-language search query into structured filters.
 *
 * Strategy:
 *   1. Check cache.
 *   2. Run rule-based parser (instant, zero cost).
 *   3. If confidence < threshold AND an AI provider is available, call AI.
 *   4. Merge rule-based results as fallback if AI fails.
 *   5. Cache and return.
 */
export async function interpretQuery(rawQuery: string): Promise<ParsedQuery> {
  if (!rawQuery || !rawQuery.trim()) {
    return { searchKeywords: '', filters: {}, confidence: 0, provider: 'rules', cached: false };
  }

  const cacheKey = normaliseQuery(rawQuery);
  const cached = interpreterCache.get(cacheKey);
  if (cached) return { ...cached, cached: true };

  // Step 1: Rule-based
  const rulesResult = parseQueryWithRules(rawQuery);

  // Step 2: Skip AI if rules are confident enough OR no AI keys configured
  const hasAI = !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  if (rulesResult.confidence >= RULE_CONFIDENCE_THRESHOLD || !hasAI) {
    interpreterCache.set(cacheKey, rulesResult);
    return rulesResult;
  }

  // Step 3: Call AI for low-confidence queries
  try {
    const prompt = buildInterpreterPrompt(rawQuery);
    const { text, provider } = await callAI(prompt);
    const aiResult = parseAIResponse(text, rawQuery);

    if (aiResult) {
      // Merge: AI result takes precedence, but fill missing fields with rules
      const merged: ParsedQuery = {
        searchKeywords: aiResult.searchKeywords || rulesResult.searchKeywords,
        filters: { ...rulesResult.filters, ...aiResult.filters },
        confidence: aiResult.confidence,
        provider,
        cached: false,
      };
      interpreterCache.set(cacheKey, merged);
      return merged;
    }
  } catch {
    // AI failed — use rules result
  }

  interpreterCache.set(cacheKey, rulesResult);
  return rulesResult;
}
