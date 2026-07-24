/**
 * variantFetcher.ts
 *
 * Fetches all available variants for a single Ajio product from Ajio's
 * internal PDP (Product Detail Page) JSON API.
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 *   • parseAjioPdpResponse() — pure function, exported for unit testing.
 *     Takes the raw PDP JSON object, returns ProductVariant[].
 *     No HTTP, no side effects, no global state.
 *
 *   • fetchAjioVariants() — async wrapper.
 *     Calls the PDP API via ScraperAPI, delegates parsing to the pure function.
 *     Returns [] on any failure — never throws.
 *
 * ── Data source ───────────────────────────────────────────────────────────────
 *   Ajio PDP API: https://www.ajio.com/api/pdp/{productCode}
 *   - Returns structured JSON at ScraperAPI plain tier (1 credit).
 *   - No JS rendering required.
 *   - productCode is already present in SearchProduct.id as "aj_{code}".
 *
 * ── Ajio PDP response shape (verified) ───────────────────────────────────────
 *   {
 *     "colorVariants": [
 *       {
 *         "colorGroup":  "469486197_white",   // "{code}_{colorName}"
 *         "images":      [{ "url": "https://..." }],
 *         "price":       { "value": 8299 },
 *         "wasPrice":    { "value": 9999 },   // MRP — may be absent
 *         "url":         "/nike-air-force-1/p/469486197_white",
 *         "available":   true
 *       }
 *     ],
 *     "sizes": [
 *       { "size": "UK 7", "available": true,  "price": { "value": 8299 } },
 *       { "size": "UK 8", "available": true,  "price": { "value": 8299 } },
 *       { "size": "UK 9", "available": false, "price": { "value": 8299 } }
 *     ]
 *   }
 *
 * ── NOT integrated yet ────────────────────────────────────────────────────────
 *   This module is not called from anywhere in the current codebase.
 *   Phase 2 will add the /api/variants route that calls fetchAjioVariants().
 */

import axios from 'axios';
import type { ProductVariant } from './types/productVariant.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const AJIO_BASE = 'https://www.ajio.com';
const AJIO_PDP_API = (code: string) => `${AJIO_BASE}/api/pdp/${code}`;

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY ?? '';
const SCRAPER_TIMEOUT_MS = 15_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a raw price value from the Ajio API to an integer INR amount.
 * Ajio prices are already numeric in the JSON (no ₹ symbol, no commas).
 * Returns 0 for absent, null, or non-numeric values.
 */
function parseAjioPrice(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw);
  if (typeof raw === 'string') {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : Math.round(n);
  }
  return 0;
}

/**
 * Extracts the human-readable color name from Ajio's colorGroup string.
 *
 * colorGroup format: "{productCode}_{colorName}"
 * Examples:
 *   "469486197_white"      → "White"
 *   "469486197_navy_blue"  → "Navy Blue"
 *   "469486197_off_white"  → "Off White"
 *
 * Returns undefined when the input is absent or malformed.
 */
function parseAjioColor(colorGroup: unknown): string | undefined {
  if (typeof colorGroup !== 'string' || !colorGroup) return undefined;
  // Strip the leading numeric product code and the first underscore
  const withoutCode = colorGroup.replace(/^\d+_/, '');
  if (!withoutCode) return undefined;
  // Replace remaining underscores with spaces and title-case each word
  return withoutCode
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Converts a relative Ajio URL to an absolute https:// URL.
 * Passes through already-absolute URLs unchanged.
 * Returns the Ajio homepage as a safe fallback for empty/invalid input.
 */
function toAbsoluteAjioUrl(url: unknown): string {
  if (typeof url !== 'string' || !url) return AJIO_BASE;
  if (url.startsWith('https://') || url.startsWith('http://')) {
    return url.replace(/^http:\/\//, 'https://');
  }
  return `${AJIO_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Converts a raw Ajio image URL to https://.
 * Ajio image URLs are sometimes http:// — always upgrade.
 */
function toAbsoluteImageUrl(url: unknown): string {
  if (typeof url !== 'string' || !url) return '';
  return url.replace(/^http:\/\//, 'https://');
}

// ─── Pure parser (exported for unit testing) ──────────────────────────────────

/**
 * parseAjioPdpResponse
 *
 * Converts a raw Ajio PDP API response object into a flat ProductVariant[].
 *
 * Ajio's data model has two independent dimensions:
 *   1. colorVariants[] — one entry per color, each with its own image,
 *      price, URL, and availability flag.
 *   2. sizes[] — a flat list of sizes for the parent product, each with
 *      its own availability and price.
 *
 * These two dimensions are NOT nested in the API response. A color variant
 * does not contain a list of sizes. This means we cannot produce a
 * color×size matrix from the PDP response alone — we produce two separate
 * variant lists:
 *   • One ProductVariant per color (size = undefined)
 *   • One ProductVariant per size  (color = undefined)
 *
 * The frontend will display them in two separate rows:
 *   Color: ⚪ White  ⚫ Black  🔵 Navy
 *   Size:  UK 7  UK 8  UK 9  UK 10
 *
 * Selecting a color changes the image and buyUrl.
 * Selecting a size changes the price (sizes can have different prices on Ajio).
 *
 * @param raw - The parsed JSON object from /api/pdp/{productCode}.
 *              Typed as `unknown` so the parser is safe against any shape.
 * @returns   - Flat array of ProductVariant. Empty array on invalid input.
 */
export function parseAjioPdpResponse(raw: unknown): ProductVariant[] {
  if (!raw || typeof raw !== 'object') return [];

  const data = raw as Record<string, unknown>;
  const variants: ProductVariant[] = [];

  // ── Color variants ──────────────────────────────────────────────────────────
  const colorVariants = data['colorVariants'];
  if (Array.isArray(colorVariants)) {
    for (const cv of colorVariants) {
      if (!cv || typeof cv !== 'object') continue;
      const c = cv as Record<string, unknown>;

      const colorGroup = c['colorGroup'];
      const color = parseAjioColor(colorGroup);
      const variantId = typeof colorGroup === 'string' ? colorGroup : '';
      if (!variantId) continue;

      // Image: prefer the first entry in images[], fall back to outfitPictureURL
      const images = c['images'];
      const firstImageUrl =
        Array.isArray(images) && images.length > 0 && typeof images[0] === 'object' && images[0] !== null
          ? toAbsoluteImageUrl((images[0] as Record<string, unknown>)['url'])
          : '';
      const outfitUrl = toAbsoluteImageUrl(
        typeof c['outfitPictureURL'] === 'string' ? c['outfitPictureURL'] : ''
      );
      const imageUrl = firstImageUrl || outfitUrl;
      if (!imageUrl) continue;

      // Price
      const priceObj = c['price'];
      const price = parseAjioPrice(
        priceObj && typeof priceObj === 'object'
          ? (priceObj as Record<string, unknown>)['value']
          : priceObj
      );
      if (price <= 0) continue;

      // MRP
      const wasPriceObj = c['wasPrice'] ?? c['wasPriceData'];
      const originalPrice = parseAjioPrice(
        wasPriceObj && typeof wasPriceObj === 'object'
          ? (wasPriceObj as Record<string, unknown>)['value']
          : wasPriceObj
      );

      // Buy URL
      const buyUrl = toAbsoluteAjioUrl(c['url']);

      // Availability — default true when absent
      const available = c['available'] !== false;

      variants.push({
        variantId,
        color,
        size: undefined,
        imageUrl,
        price,
        originalPrice: originalPrice > price ? originalPrice : undefined,
        buyUrl,
        available,
      });
    }
  }

  // ── Size variants ───────────────────────────────────────────────────────────
  // Sizes are a flat list on the parent product. Each size entry may have its
  // own price (Ajio sometimes prices sizes differently). The imageUrl and buyUrl
  // for a size variant are the same as the parent product's first color variant
  // (or the first color variant's data) — we use the first color variant's
  // image and URL as the representative, since sizes don't have their own images.
  const firstColorVariant = variants[0];
  const sizes = data['sizes'];
  if (Array.isArray(sizes) && firstColorVariant) {
    for (const sv of sizes) {
      if (!sv || typeof sv !== 'object') continue;
      const s = sv as Record<string, unknown>;

      const sizeLabel = typeof s['size'] === 'string' ? s['size'].trim() : '';
      if (!sizeLabel) continue;

      const priceObj = s['price'];
      const price = parseAjioPrice(
        priceObj && typeof priceObj === 'object'
          ? (priceObj as Record<string, unknown>)['value']
          : priceObj
      );
      // Fall back to first color variant's price when size has no price
      const effectivePrice = price > 0 ? price : firstColorVariant.price;

      const available = s['available'] !== false;

      variants.push({
        variantId: `size_${sizeLabel.replace(/\s+/g, '_').toLowerCase()}`,
        color: undefined,
        size: sizeLabel,
        imageUrl: firstColorVariant.imageUrl,
        price: effectivePrice,
        originalPrice: firstColorVariant.originalPrice,
        buyUrl: firstColorVariant.buyUrl,
        available,
      });
    }
  }

  return variants;
}

// ─── Async fetcher ────────────────────────────────────────────────────────────

/**
 * fetchAjioVariants
 *
 * Fetches all variants for a single Ajio product from the PDP API.
 *
 * Uses ScraperAPI plain tier (1 credit) — Ajio's PDP API returns structured
 * JSON without requiring JavaScript rendering.
 *
 * @param productCode - The Ajio product code, e.g. "469486197".
 *                      Extracted from SearchProduct.id by stripping the "aj_" prefix.
 * @returns           - Array of ProductVariant. Empty array on any failure.
 *
 * @example
 * const variants = await fetchAjioVariants('469486197');
 * // variants[0] → { variantId: '469486197_white', color: 'White', size: undefined, ... }
 * // variants[3] → { variantId: 'size_uk_7', color: undefined, size: 'UK 7', ... }
 */
export async function fetchAjioVariants(productCode: string): Promise<ProductVariant[]> {
  if (!productCode || !productCode.trim()) return [];
  if (!SCRAPER_API_KEY) {
    console.warn('[AjioVariants] No SCRAPER_API_KEY configured');
    return [];
  }

  const targetUrl = AJIO_PDP_API(productCode.trim());

  try {
    const { data } = await axios.get<string>('https://api.scraperapi.com/', {
      params: {
        api_key:      SCRAPER_API_KEY,
        url:          targetUrl,
        country_code: 'in',
        // No render:true — Ajio's PDP API returns JSON directly
      },
      timeout: SCRAPER_TIMEOUT_MS,
      // Keep raw string so we control JSON.parse and can catch malformed responses
      transformResponse: [(res: unknown) => res],
    });

    const text = typeof data === 'string' ? data : String(data);

    if (!text || text.length < 100) {
      console.warn(`[AjioVariants] Empty response for product ${productCode}`);
      return [];
    }

    if (/access denied|captcha|are you a human|blocked/i.test(text.slice(0, 800))) {
      console.warn(`[AjioVariants] Blocked response for product ${productCode}`);
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn(`[AjioVariants] Non-JSON response for product ${productCode}, length=${text.length}`);
      return [];
    }

    const variants = parseAjioPdpResponse(parsed);
    console.log(`[AjioVariants] product=${productCode} variants=${variants.length}`);
    return variants;

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 100) : String(e).slice(0, 100);
    console.error(`[AjioVariants] fetch error for product ${productCode}:`, msg);
    return [];
  }
}
