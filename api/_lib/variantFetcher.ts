/**
 * variantFetcher.ts
 *
 * Fetches all variant data for a single Ajio product from Ajio's
 * internal PDP JSON API.
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 *   • parseAjioPdpResponse() — pure function, exported for unit testing.
 *     Takes the raw /api/p/{colorCode} JSON, returns AjioProductVariants.
 *     No HTTP, no side effects, no global state.
 *
 *   • fetchAjioVariants() — async wrapper.
 *     Calls the PDP API via ScraperAPI, delegates parsing to the pure function.
 *     Returns null on any failure — never throws.
 *
 * ── Verified API endpoint ─────────────────────────────────────────────────────
 *   GET https://www.ajio.com/api/p/{colorCode}
 *
 *   colorCode = "{baseProduct}_{color}"  e.g. "460886329_white"
 *   Already present in SearchProduct.url as the path segment after /p/
 *   e.g. url "/nike-men-air-force-1-07-sneakers/p/460886329_white"
 *        → colorCode "460886329_white"
 *
 *   NOT /api/pdp/{productCode} — that endpoint returns HTML, not JSON.
 *
 * ── Verified response structure ───────────────────────────────────────────────
 *   {
 *     "baseProduct": "460886329",
 *     "code": "460886329_white",          ← the requested colorCode
 *
 *     "baseOptions": [{
 *       "variantType": "FnlColorVariant",
 *       "options": [                       ← ALL colors for this product
 *         {
 *           "code": "460886329_white",
 *           "color": "WHITE",
 *           "url": "/nike.../p/460886329_white",
 *           "priceData": { "value": 7495 },
 *           "wasPriceData": { "value": 7495 },
 *           "stock": { "stockLevelStatus": "inStock", "stockLevel": 10 },
 *           "modelImage": { "url": "https://assets.ajio.com/...MODEL.jpg" },
 *           "variantOptionQualifiers": [
 *             { "qualifier": "color", "swatchImage": { "url": "https://...SWATCH.jpg" } }
 *           ]
 *         }
 *       ]
 *     }],
 *
 *     "variantOptions": [                  ← ALL sizes for the REQUESTED color
 *       {
 *         "code": "460886329003",          ← full SKU (color + size)
 *         "url": "/nike.../p/460886329003",← direct buy URL for this SKU
 *         "priceData": { "value": 7495 },
 *         "wasPriceData": { "value": 7495 },
 *         "stock": { "stockLevelStatus": "inStock", "stockLevel": 37 },
 *         "modelImage": { "url": "https://assets.ajio.com/...MODEL.jpg" },
 *         "scDisplaySize": "7",            ← display label
 *         "displaySizeFormat": "UK",       ← size system
 *         "variantOptionQualifiers": [
 *           { "qualifier": "size", "value": "8" },
 *           { "qualifier": "color", "value": "white" }
 *         ]
 *       }
 *     ]
 *   }
 *
 * ── NOT integrated yet ────────────────────────────────────────────────────────
 *   This module is not called from anywhere in the current codebase.
 *   Phase 2 will add the /api/variants route that calls fetchAjioVariants().
 */

import axios from 'axios';
import type { AjioProductVariants, AjioColorVariant, AjioSizeVariant } from './types/productVariant.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const AJIO_BASE = 'https://www.ajio.com';
const AJIO_PDP_API = (colorCode: string) => `${AJIO_BASE}/api/p/${colorCode}`;

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY ?? '';
const SCRAPER_TIMEOUT_MS = 15_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw);
  if (typeof raw === 'string') {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : Math.round(n);
  }
  return 0;
}

function priceFromObj(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 0;
  return parsePrice((obj as Record<string, unknown>)['value']);
}

function toAbsoluteUrl(url: unknown): string {
  if (typeof url !== 'string' || !url) return AJIO_BASE;
  if (url.startsWith('https://')) return url;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  return `${AJIO_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function toHttps(url: unknown): string {
  if (typeof url !== 'string' || !url) return '';
  return url.replace(/^http:\/\//, 'https://');
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Color parser ─────────────────────────────────────────────────────────────

function parseColorOption(raw: unknown): AjioColorVariant | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;

  const colorCode = typeof c['code'] === 'string' ? c['code'] : '';
  if (!colorCode) return null;

  // Color name: prefer variantOptionQualifiers[qualifier=color].value,
  // fall back to the top-level color field
  const qualifiers = Array.isArray(c['variantOptionQualifiers']) ? c['variantOptionQualifiers'] : [];
  const colorQualifier = qualifiers.find(
    (q: unknown) => q && typeof q === 'object' && (q as Record<string, unknown>)['qualifier'] === 'color'
  ) as Record<string, unknown> | undefined;
  const rawColorName = colorQualifier?.['value'] ?? c['color'] ?? '';
  const colorName = typeof rawColorName === 'string' && rawColorName
    ? titleCase(rawColorName.toLowerCase().replace(/_/g, ' '))
    : '';

  // Swatch image
  const swatchRaw = colorQualifier?.['swatchImage'];
  const swatchUrl = toHttps(
    swatchRaw && typeof swatchRaw === 'object'
      ? (swatchRaw as Record<string, unknown>)['url']
      : ''
  );

  // Product image from modelImage
  const modelImage = c['modelImage'];
  const imageUrl = toHttps(
    modelImage && typeof modelImage === 'object'
      ? (modelImage as Record<string, unknown>)['url']
      : ''
  );
  if (!imageUrl) return null;

  const price = priceFromObj(c['priceData']);
  if (price <= 0) return null;

  const mrp = priceFromObj(c['wasPriceData']);
  const originalPrice = mrp > price ? mrp : undefined;

  const stockObj = c['stock'] as Record<string, unknown> | undefined;
  const available = stockObj?.['stockLevelStatus'] !== 'outOfStock';

  const buyUrl = toAbsoluteUrl(c['url']);

  return { colorCode, colorName, swatchUrl, imageUrl, price, originalPrice, available, buyUrl };
}

// ─── Size parser ──────────────────────────────────────────────────────────────

function parseSizeOption(raw: unknown, colorImageUrl: string): AjioSizeVariant | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;

  const skuCode = typeof s['code'] === 'string' ? s['code'] : '';
  if (!skuCode) return null;

  // Size label: prefer scDisplaySize (the display-formatted label),
  // fall back to the size qualifier value
  const sizeLabel = typeof s['scDisplaySize'] === 'string' && s['scDisplaySize']
    ? s['scDisplaySize']
    : (() => {
        const qualifiers = Array.isArray(s['variantOptionQualifiers']) ? s['variantOptionQualifiers'] : [];
        const sizeQ = qualifiers.find(
          (q: unknown) => q && typeof q === 'object' && (q as Record<string, unknown>)['qualifier'] === 'size'
        ) as Record<string, unknown> | undefined;
        return typeof sizeQ?.['value'] === 'string' ? sizeQ['value'] : '';
      })();
  if (!sizeLabel) return null;

  const sizeFormat = typeof s['displaySizeFormat'] === 'string' && s['displaySizeFormat']
    ? s['displaySizeFormat']
    : 'UK';

  const price = priceFromObj(s['priceData']);
  if (price <= 0) return null;

  const mrp = priceFromObj(s['wasPriceData']);
  const originalPrice = mrp > price ? mrp : undefined;

  const stockObj = s['stock'] as Record<string, unknown> | undefined;
  const available = stockObj?.['stockLevelStatus'] === 'inStock';
  const stockLevel = typeof stockObj?.['stockLevel'] === 'number' ? stockObj['stockLevel'] : 0;

  const buyUrl = toAbsoluteUrl(s['url']);

  // Image: use the SKU's own modelImage if present, otherwise inherit from color
  const modelImage = s['modelImage'];
  const skuImage = toHttps(
    modelImage && typeof modelImage === 'object'
      ? (modelImage as Record<string, unknown>)['url']
      : ''
  );
  const imageUrl = skuImage || colorImageUrl;
  if (!imageUrl) return null;

  return { skuCode, sizeLabel, sizeFormat, price, originalPrice, available, stockLevel, buyUrl, imageUrl };
}

// ─── Pure parser (exported for unit testing) ──────────────────────────────────

/**
 * parseAjioPdpResponse
 *
 * Converts a raw Ajio /api/p/{colorCode} response into AjioProductVariants.
 *
 * @param raw - The parsed JSON object from /api/p/{colorCode}.
 *              Typed as `unknown` so the parser is safe against any shape.
 * @returns   - AjioProductVariants, or null on invalid/empty input.
 */
export function parseAjioPdpResponse(raw: unknown): AjioProductVariants | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const colorCode = typeof data['code'] === 'string' ? data['code'] : '';
  const baseProduct = typeof data['baseProduct'] === 'string' ? data['baseProduct'] : '';

  // ── Colors from baseOptions[0].options ──────────────────────────────────────
  const baseOptions = Array.isArray(data['baseOptions']) ? data['baseOptions'] : [];
  const colorOptionsRaw: unknown[] =
    baseOptions.length > 0 &&
    baseOptions[0] &&
    typeof baseOptions[0] === 'object' &&
    Array.isArray((baseOptions[0] as Record<string, unknown>)['options'])
      ? (baseOptions[0] as Record<string, unknown>)['options'] as unknown[]
      : [];

  const colors: AjioColorVariant[] = colorOptionsRaw
    .map(parseColorOption)
    .filter((c): c is AjioColorVariant => c !== null);

  // ── Sizes from variantOptions ────────────────────────────────────────────────
  // variantOptions is a flat array (not nested under a wrapper object like baseOptions)
  const variantOptionsRaw = Array.isArray(data['variantOptions']) ? data['variantOptions'] : [];

  // Use the fetched color's image as fallback for sizes that lack their own image
  const fetchedColor = colors.find(c => c.colorCode === colorCode) ?? colors[0];
  const colorImageUrl = fetchedColor?.imageUrl ?? '';

  const sizes: AjioSizeVariant[] = variantOptionsRaw
    .map(s => parseSizeOption(s, colorImageUrl))
    .filter((s): s is AjioSizeVariant => s !== null);

  if (colors.length === 0 && sizes.length === 0) return null;

  return { colorCode, baseProduct, colors, sizes };
}

// ─── Async fetcher ────────────────────────────────────────────────────────────

/**
 * fetchAjioVariants
 *
 * Fetches variant data for a single Ajio product from the PDP API.
 *
 * Uses ScraperAPI plain tier (1 credit) — Ajio's /api/p/ endpoint returns
 * structured JSON without requiring JavaScript rendering.
 *
 * @param colorCode - The Ajio colorCode e.g. "460886329_white".
 *                    Extracted from SearchProduct.url by taking the segment
 *                    after /p/ — e.g. url "/nike.../p/460886329_white"
 *                    → colorCode "460886329_white".
 * @returns         - AjioProductVariants, or null on any failure.
 */
export async function fetchAjioVariants(colorCode: string): Promise<AjioProductVariants | null> {
  if (!colorCode?.trim()) return null;
  if (!SCRAPER_API_KEY) {
    console.warn('[AjioVariants] No SCRAPER_API_KEY configured');
    return null;
  }

  const targetUrl = AJIO_PDP_API(colorCode.trim());

  try {
    const { data } = await axios.get<string>('https://api.scraperapi.com/', {
      params: {
        api_key:      SCRAPER_API_KEY,
        url:          targetUrl,
        country_code: 'in',
      },
      timeout: SCRAPER_TIMEOUT_MS,
      transformResponse: [(res: unknown) => res],
    });

    const text = typeof data === 'string' ? data : String(data);

    if (!text || text.length < 100) {
      console.warn(`[AjioVariants] Empty response for colorCode ${colorCode}`);
      return null;
    }

    if (/access denied|captcha|are you a human|blocked/i.test(text.slice(0, 800))) {
      console.warn(`[AjioVariants] Blocked response for colorCode ${colorCode}`);
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn(`[AjioVariants] Non-JSON response for colorCode ${colorCode}, length=${text.length}`);
      return null;
    }

    const result = parseAjioPdpResponse(parsed);
    if (result) {
      console.log(`[AjioVariants] colorCode=${colorCode} colors=${result.colors.length} sizes=${result.sizes.length}`);
    } else {
      console.warn(`[AjioVariants] No variant data parsed for colorCode ${colorCode}`);
    }
    return result;

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 100) : String(e).slice(0, 100);
    console.error(`[AjioVariants] fetch error for colorCode ${colorCode}:`, msg);
    return null;
  }
}
