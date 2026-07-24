/**
 * normalizedProduct.ts
 *
 * Type definitions for the Product Identity Resolution system.
 *
 * NormalizedProduct is the internal representation produced by the
 * normalization engine. It is never stored in the database and never
 * sent to the frontend — it exists only as an intermediate value
 * inside the matching pipeline.
 *
 * The original SearchProduct is always preserved unchanged on
 * `originalProduct` so the rest of the pipeline can still access
 * every raw field (price, imageUrl, affiliateUrl, etc.) without
 * re-fetching anything.
 */

import type { SearchProduct } from './searchProduct.js';

// ─── NormalizedProduct ────────────────────────────────────────────────────────

export interface NormalizedProduct {
  /**
   * The original, unmodified SearchProduct from the scraper.
   * Never mutated. All downstream consumers read raw data from here.
   */
  readonly originalProduct: SearchProduct;

  /**
   * Lowercased, punctuation-stripped, stop-word-removed, whitespace-collapsed
   * version of the product title. Used for human-readable display in debug
   * output and logs — NOT used directly for matching (use `tokens` instead).
   *
   * Example:
   *   "Nike Men's Air Force 1 '07 Sneaker - White/White (Size: 10)"
   *   → "nike mens air force 1 07 sneaker white white"
   */
  readonly normalizedTitle: string;

  /**
   * Lowercased, trimmed brand name derived from the existing `brand` field.
   * `undefined` when the source platform did not provide a brand
   * (common on Meesho, occasional on Amazon).
   *
   * No alias table is applied in V1 — "H&M" and "H and M" will produce
   * different values. Alias resolution is a Phase 2 data task.
   *
   * Example: "Nike" → "nike"
   */
  readonly normalizedBrand: string | undefined;

  /**
   * Sorted, deduplicated array of meaningful tokens extracted from
   * `normalizedTitle` after stop-word removal.
   *
   * Tokens are sorted alphabetically so that two titles with the same
   * words in different order produce identical token sets — this is the
   * primary input to the Jaccard similarity scorer in Milestone 2.
   *
   * Example:
   *   "nike mens air force 1 07 sneaker white white"
   *   stop-words removed, deduplicated, sorted:
   *   → ["07", "air", "force", "mens", "nike", "sneaker", "white"]
   *
   * Tokens shorter than MIN_TOKEN_LENGTH (2 chars) are dropped to avoid
   * noise from single-letter size codes and stray punctuation fragments.
   */
  readonly tokens: readonly string[];

  /**
   * Lowercased color string extracted from the platform's structured
   * color field (Ajio: `color`, others: `undefined`).
   *
   * This is NOT extracted from the title — only from the dedicated field
   * that the scraper already populates. Extracting color from free-text
   * titles is a Phase 2 task.
   *
   * `undefined` when the platform did not provide a structured color.
   *
   * Example: "Navy Blue" → "navy blue"
   */
  readonly color: string | undefined;

  /**
   * Lowercased, trimmed size string from the platform's structured size
   * field (Flipkart: `size`, others: `undefined`).
   *
   * Same rule as `color` — only from the dedicated field, never guessed
   * from the title.
   *
   * `undefined` when the platform did not provide a structured size.
   *
   * Example: "XL" → "xl"
   */
  readonly size: string | undefined;
}
