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
  readonly originalProduct: SearchProduct;
  readonly normalizedTitle: string;
  readonly normalizedBrand: string | undefined;
  readonly tokens: readonly string[];
  /** Canonical color — from structured field first, then extracted from title. */
  readonly color: string | undefined;
  /** Canonical size — from structured field first, then extracted from title. */
  readonly size: string | undefined;
  /** Detected gender: 'men' | 'women' | 'unisex' | undefined */
  readonly gender: 'men' | 'women' | 'unisex' | undefined;
  /** Extracted model/SKU identifier (e.g. "af1", "511", "sm123"). */
  readonly model: string | undefined;
}
