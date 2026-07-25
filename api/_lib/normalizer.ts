/**
 * normalizer.ts
 *
 * Normalization Engine — Milestone 1 of the Product Identity Resolution system.
 *
 * Converts a raw SearchProduct into a NormalizedProduct ready for matching.
 *
 * ── Guarantees ────────────────────────────────────────────────────────────────
 *   • Pure functions only — no database, no cache, no HTTP, no side effects.
 *   • The original SearchProduct is never mutated.
 *   • Every function is independently testable.
 *   • Strict TypeScript — no `any`, no `@ts-ignore`.
 */

import type { SearchProduct } from './types/searchProduct.js';
import type { NormalizedProduct } from './types/normalizedProduct.js';
import { VOCAB_MAP } from './vocab.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_TOKEN_LENGTH = 2;

const STOP_WORDS = new Set<string>([
  'with', 'and', 'for', 'the', 'buy', 'online', 'india', 'new', 'best',
  'latest', 'exclusive', 'special', 'offer', 'sale', 'free', 'shipping',
  'at', 'in', 'on', 'of', 'to', 'by', 'an', 'is', 'it',
  'get', 'shop', 'from', 'only', 'just', 'upto', 'off',
  'pack', 'set', 'combo', 'piece', 'pcs', 'qty',
  'style', 'design', 'pattern', 'print', 'printed',
  'collection', 'edition', 'series', 'range',
  'casual', 'formal', 'regular', 'classic',
  'myntra', 'ajio', 'amazon', 'flipkart', 'meesho',
]);

// ─── Brand alias table ────────────────────────────────────────────────────────
// Maps every known surface form (lowercase) → canonical brand key.

const BRAND_ALIASES: Readonly<Record<string, string>> = {
  "levi's":            'levis',
  'levis':             'levis',
  "levi's strauss":    'levis',
  'levis strauss':     'levis',
  'h&m':               'hm',
  'h and m':           'hm',
  'hm':                'hm',
  'u.s. polo':         'us polo',
  'us polo':           'us polo',
  'u.s. polo assn':    'us polo',
  'us polo assn':      'us polo',
  'uspa':              'us polo',
  'roadster':          'roadster',
  'w for woman':       'w',
  'adidas originals':  'adidas',
  'nike sportswear':   'nike',
  'reebok classic':    'reebok',
};

// ─── Color vocabulary ─────────────────────────────────────────────────────────
// Ordered longest-first so multi-word colors match before single words.

const COLOR_TERMS: readonly string[] = [
  'navy blue', 'sky blue', 'royal blue', 'light blue', 'dark blue',
  'light green', 'dark green', 'olive green',
  'light pink', 'hot pink', 'dark pink',
  'light grey', 'dark grey', 'light gray', 'dark gray',
  'off white', 'rose gold',
  'navy', 'olive', 'maroon', 'beige', 'khaki', 'coral', 'teal', 'indigo',
  'lavender', 'mustard', 'burgundy', 'charcoal', 'ivory', 'rust',
  'white', 'black', 'blue', 'green', 'red', 'pink', 'grey', 'gray',
  'brown', 'purple', 'yellow', 'orange', 'gold', 'silver', 'multi',
];

// ─── Size vocabulary ──────────────────────────────────────────────────────────

const LETTER_SIZES = new Set<string>(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '2xl', '3xl']);
// Numeric waist/chest sizes (jeans, trousers): 26–44
const NUMERIC_SIZE_RE = /\b(2[6-9]|3[0-9]|4[0-4])\b/;

// ─── Gender vocabulary ────────────────────────────────────────────────────────

const MEN_TERMS    = new Set(['men', 'mens', 'male', 'boys', 'boy', 'gents']);
const WOMEN_TERMS  = new Set(['women', 'womens', 'female', 'girls', 'girl', 'ladies', 'lady']);
const UNISEX_TERMS = new Set(['unisex']);

// ─── Model/SKU pattern ────────────────────────────────────────────────────────
// Matches identifiers like: AF1, AF-1, 511, SM-N123, SKU12345
// Must contain at least one digit.

// Three alternations:
//   1. letters-hyphen-alphanumeric (SM-N986B, AF-1)
//   2. letters immediately followed by digit (AF1, SKU123)
//   3. pure numeric 2-6 digits optionally followed by letters (511, 501, 32B)
const MODEL_RE = /\b([a-z]{1,5}-[a-z0-9][\w-]{1,10}|[a-z]{1,5}\d[\w-]{0,10}|\d{2,6}[a-z]{0,4})\b/gi;

// ─── Step functions ───────────────────────────────────────────────────────────

export function toLower(input: string): string { return input.toLowerCase(); }
export function trim(input: string): string { return input.trim(); }
export function removePunctuation(input: string): string { return input.replace(/[^a-z0-9 ]/g, ' '); }
export function collapseSpaces(input: string): string { return input.replace(/\s+/g, ' ').trim(); }

export function removeStopWords(input: string): string {
  return input.split(' ').filter((w) => w.length > 0 && !STOP_WORDS.has(w)).join(' ');
}

export function tokenize(input: string): string[] {
  return input.split(' ').filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

export function applyVocab(token: string): string {
  return VOCAB_MAP[token] ?? token;
}

export function sortAndDedupe(tokens: string[]): string[] {
  return [...new Set(tokens)].sort();
}

// ─── Brand normalization with alias resolution ────────────────────────────────

export function normalizeBrand(brand: string | undefined): string | undefined {
  if (!brand) return undefined;
  // Strip trailing ® ™ before lookup
  const lower = trim(toLower(brand)).replace(/[®™]/g, '').trim();
  if (!lower) return undefined;
  return BRAND_ALIASES[lower] ?? lower;
}

// ─── Color extraction ─────────────────────────────────────────────────────────

/**
 * Returns the first recognized color from the structured field (priority)
 * or by scanning the raw title. Returns undefined when nothing is found.
 */
export function extractColor(
  structuredColor: string | undefined,
  rawTitle: string,
): string | undefined {
  if (structuredColor) {
    const c = trim(toLower(structuredColor));
    if (c) return c;
  }
  const lower = toLower(rawTitle);
  for (const color of COLOR_TERMS) {
    const re = new RegExp(`(?<![a-z])${color}(?![a-z])`, 'i');
    if (re.test(lower)) return color;
  }
  return undefined;
}

// ─── Size extraction ──────────────────────────────────────────────────────────

/**
 * Returns the first recognized size from the structured field (priority)
 * or by scanning the raw title. Returns undefined when nothing is found.
 */
export function extractSize(
  structuredSize: string | undefined,
  rawTitle: string,
): string | undefined {
  if (structuredSize) {
    const s = trim(toLower(structuredSize));
    if (s) return s;
  }
  const lower = toLower(rawTitle);
  // Numeric waist/chest sizes checked first — prevents "32" in "Jeans 32"
  // from being shadowed by a letter-size match on an earlier word.
  const numMatch = lower.match(NUMERIC_SIZE_RE);
  if (numMatch) return numMatch[1];
  // Letter sizes — whole word only (not inside longer words or numbers)
  for (const sz of LETTER_SIZES) {
    const re = new RegExp(`(?<![a-z0-9])${sz}(?![a-z0-9])`, 'i');
    if (re.test(lower)) return sz;
  }
  return undefined;
}

// ─── Gender extraction ────────────────────────────────────────────────────────

/**
 * Detects gender signal from a raw title.
 * Returns 'men' | 'women' | 'unisex' | undefined.
 * When both men and women terms appear, returns 'unisex'.
 */
export function extractGender(rawTitle: string): 'men' | 'women' | 'unisex' | undefined {
  const words = toLower(rawTitle).split(/\W+/);
  let hasMen = false;
  let hasWomen = false;
  for (const word of words) {
    if (UNISEX_TERMS.has(word)) return 'unisex';
    if (WOMEN_TERMS.has(word)) hasWomen = true;
    if (MEN_TERMS.has(word))   hasMen   = true;
  }
  if (hasMen && hasWomen) return 'unisex';
  if (hasWomen) return 'women';
  if (hasMen)   return 'men';
  return undefined;
}

// ─── Model/SKU extraction ─────────────────────────────────────────────────────

/**
 * Extracts the most specific model/SKU identifier from a raw title.
 * Returns the longest match or undefined.
 *
 * Examples:
 *   "Nike Air Force 1 '07"  → "07"
 *   "Levi's 511 Slim Fit"   → "511"
 *   "Samsung SM-N986B"      → "sm-n986b"
 */
export function extractModel(rawTitle: string): string | undefined {
  const lower = toLower(rawTitle);
  const matches = [...lower.matchAll(MODEL_RE)].map((m) => m[0]);
  if (!matches.length) return undefined;
  return matches.sort((a, b) => b.length - a.length)[0];
}

// ─── Title pipeline ───────────────────────────────────────────────────────────

export function normalizeTitle(rawTitle: string): string {
  return removeStopWords(collapseSpaces(removePunctuation(trim(toLower(rawTitle)))));
}

export function buildTokens(rawTitle: string): string[] {
  return sortAndDedupe(tokenize(normalizeTitle(rawTitle)).map(applyVocab));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function normalizeProduct(product: SearchProduct): NormalizedProduct {
  return {
    originalProduct: product,
    normalizedTitle: normalizeTitle(product.title),
    normalizedBrand: normalizeBrand(product.brand),
    tokens:          buildTokens(product.title),
    color:           extractColor(product.color, product.title),
    size:            extractSize(product.size, product.title),
    gender:          extractGender(product.title),
    model:           extractModel(product.title),
  };
}

export function normalizeProducts(products: SearchProduct[]): NormalizedProduct[] {
  return products.map(normalizeProduct);
}
