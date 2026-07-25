/**
 * normalizer.ts
 *
 * Normalization Engine — Milestone 1 of the Product Identity Resolution system.
 *
 * Converts a raw SearchProduct (as returned by any platform scraper) into a
 * NormalizedProduct: a consistent internal representation suitable for
 * identity matching in Milestone 2.
 *
 * ── Guarantees ────────────────────────────────────────────────────────────────
 *   • Pure functions only — no database, no cache, no HTTP, no side effects.
 *   • The original SearchProduct is never mutated.
 *   • Every function is independently testable.
 *   • Strict TypeScript — no `any`, no `@ts-ignore`.
 *
 * ── What this module does NOT do (deferred to Phase 2) ───────────────────────
 *   • Brand alias resolution  ("H&M" ↔ "H and M")
 *   • Category taxonomy mapping
 *   • Model / SKU code extraction
 *   • Gender normalization
 *   • Color extraction from free-text titles
 */

import type { SearchProduct } from './types/searchProduct.js';
import type { NormalizedProduct } from './types/normalizedProduct.js';
import { VOCAB_MAP } from './vocab.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum token length. Tokens shorter than this are discarded.
 * Eliminates single-letter noise ("a", "b") and stray punctuation
 * fragments that survive the cleaning step.
 */
const MIN_TOKEN_LENGTH = 2;

/**
 * Stop words to remove from product titles before tokenization.
 *
 * Sourced from two places:
 *   1. The existing STOP_WORDS set already used in search.ts for the
 *      relevance filter — kept identical to stay consistent.
 *   2. Additional fashion/e-commerce noise words observed across
 *      Amazon, Flipkart, Myntra, Ajio, and Meesho title formats.
 *
 * Deliberately conservative — only words that carry zero product
 * identity signal are included. "cotton", "slim", "regular" are NOT
 * stop words even though they are common, because they distinguish
 * products (cotton kurta ≠ silk kurta).
 */
const STOP_WORDS = new Set<string>([
  // ── From existing search.ts STOP_WORDS (kept in sync) ──
  'with', 'and', 'for', 'the', 'buy', 'online', 'india', 'new', 'best',
  'latest', 'exclusive', 'special', 'offer', 'sale', 'free', 'shipping',
  // ── E-commerce platform noise ──
  'at', 'in', 'on', 'of', 'to', 'by', 'an', 'is', 'it',
  'get', 'shop', 'from', 'only', 'just', 'upto', 'off',
  // ── Fashion listing noise ──
  'pack', 'set', 'combo', 'piece', 'pcs', 'qty',
  'style', 'design', 'pattern', 'print', 'printed',
  'collection', 'edition', 'series', 'range',
  // ── Platform-specific suffixes seen in scraped titles ──
  'myntra', 'ajio', 'amazon', 'flipkart', 'meesho',
]);

// ─── Step 1 — Lowercase ───────────────────────────────────────────────────────

/**
 * Converts a string to lowercase.
 * Applied first so all subsequent steps work on a uniform case.
 */
export function toLower(input: string): string {
  return input.toLowerCase();
}

// ─── Step 2 — Trim whitespace ─────────────────────────────────────────────────

/**
 * Removes leading and trailing whitespace.
 */
export function trim(input: string): string {
  return input.trim();
}

// ─── Step 3 — Remove punctuation ─────────────────────────────────────────────

/**
 * Strips punctuation and special characters, replacing them with a space.
 *
 * Keeps:
 *   • ASCII letters (a-z after lowercasing)
 *   • ASCII digits (0-9) — product codes like "501", "AF1" are identity signals
 *   • Single spaces (collapsed in step 4)
 *
 * Removes:
 *   • Apostrophes  → "men's" becomes "mens", "levi's" becomes "levis"
 *   • Hyphens      → "full-sleeve" becomes "full sleeve"
 *   • Slashes      → "white/black" becomes "white black"
 *   • Brackets, parens, quotes, and all other punctuation
 *   • The ₹ symbol and other currency/special Unicode characters
 *
 * Note: This intentionally converts "H&M" → "h m" (two tokens) in V1.
 * Brand alias resolution ("hm") is a Phase 2 data task.
 */
export function removePunctuation(input: string): string {
  return input.replace(/[^a-z0-9 ]/g, ' ');
}

// ─── Step 4 — Collapse duplicate spaces ──────────────────────────────────────

/**
 * Replaces any run of whitespace (spaces, tabs, newlines) with a single space,
 * then trims again. Called after removePunctuation which can introduce
 * consecutive spaces where punctuation was removed.
 */
export function collapseSpaces(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

// ─── Step 5 — Remove stop words ──────────────────────────────────────────────

/**
 * Splits the input on spaces, filters out stop words, and rejoins.
 * Only exact whole-word matches are removed — "best" is removed but
 * "bestfit" is not.
 */
export function removeStopWords(input: string): string {
  return input
    .split(' ')
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
    .join(' ');
}

// ─── Step 6 — Tokenize ───────────────────────────────────────────────────────

/**
 * Splits a cleaned title string into individual tokens.
 * Drops tokens shorter than MIN_TOKEN_LENGTH to remove noise.
 */
export function tokenize(input: string): string[] {
  return input
    .split(' ')
    .filter((token) => token.length >= MIN_TOKEN_LENGTH);
}

// ─── Step 6.5 — Apply vocabulary normalization ──────────────────────────────

/**
 * Maps a single token to its canonical form using VOCAB_MAP.
 *
 * Examples:
 *   "sneakers" → "sneaker"
 *   "shoes"    → "shoe"
 *   "kurtas"   → "kurta"
 *
 * Returns the token unchanged when it has no entry in the map.
 * Pure — no side effects, no mutation.
 */
export function applyVocab(token: string): string {
  return VOCAB_MAP[token] ?? token;
}

// ─── Step 7 — Sort and deduplicate tokens ────────────────────────────────────

/**
 * Sorts tokens alphabetically and removes duplicates.
 *
 * Sorting is the key step that makes order-independent matching possible:
 * "Air Force Nike Sneaker" and "Nike Air Force Sneaker" produce the same
 * sorted token set → identical Jaccard similarity score in Milestone 2.
 *
 * Deduplication prevents a repeated word (e.g. "white white" from a
 * "White/White" colorway) from inflating the intersection count.
 */
export function sortAndDedupe(tokens: string[]): string[] {
  return [...new Set(tokens)].sort();
}

// ─── Step 8 — Normalize brand ────────────────────────────────────────────────

/**
 * Normalizes a brand string to a consistent lowercase, trimmed form.
 *
 * Uses only the existing `brand` field from the SearchProduct — no alias
 * table, no extraction from the title. Returns `undefined` when the
 * platform did not provide a brand (Meesho frequently omits it).
 *
 * V1 intentionally keeps this simple. "H&M" and "H and M" will produce
 * "h&m" and "h and m" respectively — different strings. The brand alias
 * table that maps these to a canonical "hm" is a Phase 2 data task.
 */
export function normalizeBrand(brand: string | undefined): string | undefined {
  if (!brand) return undefined;
  const cleaned = trim(toLower(brand));
  return cleaned.length > 0 ? cleaned : undefined;
}

// ─── Step 9 — Normalize color ────────────────────────────────────────────────

/**
 * Normalizes a color string from the platform's structured color field.
 * Only called when the scraper has already populated `color` (Ajio only in V1).
 * Returns `undefined` for absent or empty values.
 *
 * Example: "Navy Blue" → "navy blue"
 */
export function normalizeColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const cleaned = trim(toLower(color));
  return cleaned.length > 0 ? cleaned : undefined;
}

// ─── Step 10 — Normalize size ────────────────────────────────────────────────

/**
 * Normalizes a size string from the platform's structured size field.
 * Only called when the scraper has already populated `size` (Flipkart only in V1).
 * Returns `undefined` for absent or empty values.
 *
 * Example: "XL" → "xl"
 */
export function normalizeSize(size: string | undefined): string | undefined {
  if (!size) return undefined;
  const cleaned = trim(toLower(size));
  return cleaned.length > 0 ? cleaned : undefined;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Runs a raw title string through the full normalization pipeline:
 *   toLower → trim → removePunctuation → collapseSpaces → removeStopWords
 *
 * Returns the cleaned title string. Separated from tokenization so the
 * normalized title can be stored for logging/debugging independently of
 * the token array.
 */
export function normalizeTitle(rawTitle: string): string {
  return removeStopWords(
    collapseSpaces(
      removePunctuation(
        trim(
          toLower(rawTitle)
        )
      )
    )
  );
}

/**
 * Converts a raw title into a sorted, deduplicated token array.
 * This is the value used by the Jaccard similarity scorer in Milestone 2.
 */
export function buildTokens(rawTitle: string): string[] {
  return sortAndDedupe(
    tokenize(
      normalizeTitle(rawTitle)
    ).map(applyVocab)
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * normalizeProduct
 *
 * The single public entry point for the normalization engine.
 *
 * Accepts a SearchProduct (as returned by any platform scraper) and
 * returns a NormalizedProduct. The original product is never mutated —
 * it is attached as `originalProduct` on the result.
 *
 * @param product - A raw SearchProduct from any platform scraper.
 * @returns       - A NormalizedProduct ready for identity matching.
 *
 * @example
 * const raw = {
 *   id: 'az_B09XYZ',
 *   title: "Nike Men's Air Force 1 '07 Sneaker - White/White",
 *   brand: 'Nike',
 *   price: 7495,
 *   platform: 'Amazon India',
 *   ...
 * };
 * const normalized = normalizeProduct(raw);
 * // normalized.tokens → ["07", "air", "force", "mens", "nike", "sneaker", "white"]
 */
export function normalizeProduct(product: SearchProduct): NormalizedProduct {
  const nt = normalizeTitle(product.title);

  return {
    originalProduct:  product,
    normalizedTitle:  nt,
    normalizedBrand:  normalizeBrand(product.brand),
    tokens:           buildTokens(product.title),
    color:            normalizeColor(product.color),
    size:             normalizeSize(product.size),
  };
}

/**
 * normalizeProducts
 *
 * Convenience wrapper — normalizes an array of SearchProducts in one call.
 * Order is preserved. Each product is processed independently.
 *
 * @param products - Array of raw SearchProducts.
 * @returns        - Array of NormalizedProducts in the same order.
 */
export function normalizeProducts(products: SearchProduct[]): NormalizedProduct[] {
  return products.map(normalizeProduct);
}
