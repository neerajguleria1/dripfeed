/**
 * searchProduct.ts
 *
 * Standalone type definition for SearchProduct.
 *
 * Extracted from search.ts so that downstream modules (normalizer,
 * matcher, tests) can import the type without pulling in the full
 * search module and its heavy dependencies (axios, mongoose, etc.).
 *
 * search.ts re-exports this type to keep its public API unchanged.
 */

export interface SearchProduct {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  imageUrl: string;
  platform: string;
  url: string;
  brand?: string;
  rating?: number;
  affiliateUrl?: string;
  /**
   * Variant info — NOT available uniformly across platforms.
   * Populated only when the platform's search API exposes it in
   * structured form (verified against live responses, not guessed):
   *   - Ajio:     color reliable, size never present in search results
   *   - Flipkart: size reliable ("Size: S/M/L/XL" in titles.coSubtitle),
   *               color not structured
   *   - Amazon / Meesho: neither field available in search results
   * Leave undefined rather than guess.
   */
  color?: string;
  size?: string;
}
