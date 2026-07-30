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
import type { AjioProductVariants, AjioColorVariant, AjioSizeVariant, ProductVariants, VariantColor, VariantSize } from './types/productVariant.js';

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
async function fetchAjioVariantsDirect(colorCode: string): Promise<AjioProductVariants | null> {
  try {
    const { data } = await axios.get<string>(AJIO_PDP_API(colorCode), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.ajio.com/',
      },
      timeout: 8000,
      transformResponse: [(res: unknown) => res],
    });
    const text = typeof data === 'string' ? data : String(data);
    if (!text || text.length < 100) return null;
    if (/access denied|captcha|blocked/i.test(text.slice(0, 400))) return null;
    const parsed = JSON.parse(text);
    return parseAjioPdpResponse(parsed);
  } catch {
    return null;
  }
}

export async function fetchAjioVariants(colorCode: string): Promise<AjioProductVariants | null> {
  if (!colorCode?.trim()) return null;

  // Try direct first — 0 credits
  const direct = await fetchAjioVariantsDirect(colorCode.trim());
  if (direct) {
    console.log(`[AjioVariants] direct hit colorCode=${colorCode} colors=${direct.colors.length} sizes=${direct.sizes.length}`);
    return direct;
  }

  // Fallback: ScraperAPI plain tier — 1 credit
  if (!SCRAPER_API_KEY) {
    console.warn('[AjioVariants] No SCRAPER_API_KEY configured');
    return null;
  }

  try {
    const { data } = await axios.get<string>('https://api.scraperapi.com/', {
      params: { api_key: SCRAPER_API_KEY, url: AJIO_PDP_API(colorCode.trim()), country_code: 'in' },
      timeout: SCRAPER_TIMEOUT_MS,
      transformResponse: [(res: unknown) => res],
    });
    const text = typeof data === 'string' ? data : String(data);
    if (!text || text.length < 100 || /access denied|captcha|blocked/i.test(text.slice(0, 800))) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return null; }
    const result = parseAjioPdpResponse(parsed);
    if (result) console.log(`[AjioVariants] scraperapi colorCode=${colorCode} colors=${result.colors.length} sizes=${result.sizes.length}`);
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 100) : String(e).slice(0, 100);
    console.error(`[AjioVariants] fetch error for colorCode ${colorCode}:`, msg);
    return null;
  }
}

// ─── ScraperAPI helper ────────────────────────────────────────────────────────

function scraperUrl(target: string, opts?: { render?: boolean; wait?: number }): string {
  const apiKey = SCRAPER_API_KEY || process.env.SCRAPER_API_KEY;
  let url = `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(target)}&country_code=in&device_type=desktop`;
  if (opts?.render) url += '&render=true';
  if (opts?.wait) url += `&wait_for_selector=.${opts.wait}`;
  return url;
}

// ─── Amazon variant fetcher ───────────────────────────────────────────────────

async function fetchAmazonVariants(productUrl: string): Promise<ProductVariants | null> {
  try {
    const url = scraperUrl(productUrl, { render: true });
    const { data: html } = await axios.get<string>(url, {
      timeout: 25000,
      transformResponse: [(r) => r],
    });
    if (typeof html !== 'string' || html.length < 500) return null;

    const title = html.match(/<span id="productTitle"[^>]*>([^<]+)<\/span>/)?.[1]?.trim() || '';
    const brand = html.match(/<a id="bylineInfo"[^>]*>([^<]+)<\/a>/)?.[1]?.replace(/^Visit the\s+/i, '').trim() || '';

    // Color variants
    const colors: VariantColor[] = [];
    const colorSection = html.match(/<div[^>]*id="variation_color_name"[^>]*>([\s\S]*?)<\/div>/i);
    if (colorSection) {
      const colorButtons = [...colorSection[1].matchAll(/<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"[^>]*>/gi)];
      const processed = new Set<string>();
      for (const btn of colorButtons) {
        const name = btn[2]?.trim();
        if (!name || processed.has(name)) continue;
        processed.add(name);
        colors.push({
          id: name.toLowerCase().replace(/\s+/g, '_'),
          name,
          swatchUrl: btn[1],
          imageUrl: html.match(/id="landingImage"[^>]+src="([^"]+)"/)?.[1] || btn[1],
          price: 0,
          available: true,
          buyUrl: productUrl,
        });
      }
      // Fallback: text-only buttons
      if (colors.length === 0) {
        const textBtns = [...colorSection[1].matchAll(/class="a-button-text"[^>]*>([^<]+)</gi)];
        for (const btn of textBtns) {
          const name = btn[1]?.trim();
          if (!name || name === '\\u00a0' || processed.has(name)) continue;
          processed.add(name);
          colors.push({
            id: name.toLowerCase().replace(/\s+/g, '_'),
            name,
            imageUrl: html.match(/id="landingImage"[^>]+src="([^"]+)"/)?.[1] || '',
            price: 0,
            available: true,
            buyUrl: productUrl,
          });
        }
      }
    }

    // Size variants
    const sizes: VariantSize[] = [];
    const sizeSection = html.match(/<div[^>]*id="variation_size_name"[^>]*>([\s\S]*?)<\/div>/i);
    if (sizeSection) {
      const sizeTexts = [...sizeSection[1].matchAll(/class="a-button-text"[^>]*>([^<]+)</gi)];
      const seenSizes = new Set<string>();
      for (const st of sizeTexts) {
        const name = st[1]?.trim();
        if (!name || name === '\\u00a0' || seenSizes.has(name)) continue;
        seenSizes.add(name);
        sizes.push({
          id: name.toLowerCase().replace(/\s+/g, '_'),
          label: name,
          price: 0,
          available: true,
          buyUrl: productUrl,
        });
      }
    }

    return { platform: 'Amazon India', productId: productUrl, title, brand, colors, sizes };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : '';
    console.error('[AmazonVariants] fetch error:', msg);
    return null;
  }
}

// ─── Flipkart variant fetcher ─────────────────────────────────────────────────

async function fetchFlipkartVariants(productUrl: string): Promise<ProductVariants | null> {
  try {
    const { data: html } = await axios.get<string>(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      timeout: 10000,
      transformResponse: [(r) => r],
    });
    if (typeof html !== 'string' || !html.includes('window.__INITIAL_STATE__')) return null;

    const stateStart = html.indexOf('window.__INITIAL_STATE__');
    const braceOpen = html.indexOf('{', stateStart);
    if (braceOpen === -1) return null;
    let depth = 0, end = 0;
    for (let i = braceOpen; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (!end) return null;
    const state = JSON.parse(html.slice(braceOpen, end));

    const pageData = state?.pageDataV4?.page?.data || {};
    const slots: any[] = Object.values(pageData).flat() as any[];
    let productInfo: any = null;
    for (const slot of slots) {
      const p = (slot as any)?.widget?.data?.product;
      if (p) { productInfo = p; break; }
    }
    if (!productInfo) return null;

    const info = productInfo.productInfo?.value || productInfo;
    const title = info.titles?.title || info.titles?.newTitle || '';
    const brand = info.titles?.superTitle || '';

    // Colors from colorVariant section
    const colors: VariantColor[] = [];
    const colorVariants = info?.variants?.colorVariant || info?.colorVariants || [];
    const processedColors = new Set<string>();
    for (const cv of colorVariants) {
      const name = cv.colorName || cv.color || '';
      if (!name || processedColors.has(name.toLowerCase())) continue;
      processedColors.add(name.toLowerCase());
      colors.push({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        swatchUrl: cv.colorImageUrl || cv.swatchUrl || '',
        imageUrl: cv.imageUrl || cv.productImageUrl || info.media?.images?.[0]?.url?.replace('{@width}', '600').replace('{@height}', '800') || '',
        price: parsePrice(cv.price || info.pricing?.price || 0),
        originalPrice: cv.originalPrice ? parsePrice(cv.originalPrice) : undefined,
        available: cv.available ?? true,
        buyUrl: cv.url ? `https://www.flipkart.com${cv.url}` : productUrl,
      });
    }

    // Sizes from sizeVariant section
    const sizes: VariantSize[] = [];
    const sizeVariants = info?.variants?.sizeVariant || info?.sizeVariants || [];
    const processedSizes = new Set<string>();
    for (const sv of sizeVariants) {
      const label = sv.sizeLabel || sv.value || sv.size || '';
      if (!label || processedSizes.has(label)) continue;
      processedSizes.add(label);
      sizes.push({
        id: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        format: sv.sizeUnit || sv.sizeType || '',
        price: parsePrice(sv.price || info.pricing?.price || 0),
        originalPrice: sv.originalPrice ? parsePrice(sv.originalPrice) : undefined,
        available: sv.available ?? true,
        buyUrl: sv.url ? `https://www.flipkart.com${sv.url}` : productUrl,
      });
    }

    return { platform: 'Flipkart', productId: productUrl, title, brand, colors, sizes };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : '';
    console.error('[FlipkartVariants] fetch error:', msg);
    return null;
  }
}

// ─── Myntra variant fetcher ───────────────────────────────────────────────────

async function fetchMyntraVariants(productUrl: string): Promise<ProductVariants | null> {
  try {
    const url = scraperUrl(productUrl);
    const { data: html } = await axios.get<string>(url, {
      timeout: 20000,
      transformResponse: [(r) => r],
    });
    if (typeof html !== 'string' || html.length < 500) return null;

    // Try embedded JSON
    const scriptMatch = html.match(/window\.__myx\s*=\s*(\{[\s\S]*?\});/);
    const data = scriptMatch ? JSON.parse(scriptMatch[1]) : null;
    const productData = data?.pdpData?.product || data?.productData || {};

    const title = productData.productName || productData.name || html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() || '';
    const brand = productData.brand?.name || productData.brand || html.match(/class="pdp-brand"[^>]*>([^<]+)</i)?.[1]?.trim() || '';

    const colors: VariantColor[] = [];
    const rawColors = productData.colors || productData.colorVariants || [];
    const processedColors = new Set<string>();
    for (const c of rawColors) {
      const name = c.colorName || c.color || '';
      if (!name || processedColors.has(name.toLowerCase())) continue;
      processedColors.add(name.toLowerCase());
      colors.push({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        swatchUrl: c.swatchImage || c.swatchUrl || '',
        imageUrl: c.imageUrl || c.searchImage || productData.searchImage || '',
        price: parsePrice(c.price || productData.price || 0),
        originalPrice: c.originalPrice ? parsePrice(c.originalPrice) : undefined,
        available: c.available ?? true,
        buyUrl: c.url ? `https://www.myntra.com/${c.url}` : productUrl,
      });
    }

    const sizes: VariantSize[] = [];
    const rawSizes = productData.sizes || productData.sizeVariants || [];
    const processedSizes = new Set<string>();
    for (const s of rawSizes) {
      const label = s.sizeLabel || s.label || s.size || '';
      if (!label || processedSizes.has(label)) continue;
      processedSizes.add(label);
      sizes.push({
        id: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        format: s.sizeType || s.sizeFormat || '',
        price: parsePrice(s.price || productData.price || 0),
        originalPrice: s.originalPrice ? parsePrice(s.originalPrice) : undefined,
        available: s.available ?? true,
        buyUrl: s.url ? `https://www.myntra.com/${s.url}` : productUrl,
      });
    }

    return { platform: 'Myntra', productId: productUrl, title, brand, colors, sizes };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : '';
    console.error('[MyntraVariants] fetch error:', msg);
    return null;
  }
}

// ─── Meesho variant fetcher ───────────────────────────────────────────────────

async function fetchMeeshoVariants(productUrl: string): Promise<ProductVariants | null> {
  try {
    const url = scraperUrl(productUrl, { render: true, wait: 8000 });
    const { data: html } = await axios.get<string>(url, {
      timeout: 30000,
      transformResponse: [(r) => r],
    });
    if (typeof html !== 'string' || html.length < 500) return null;

    const title = html.match(/class="ProductTitle__product-name"[^>]*>([^<]+)</i)?.[1]?.trim()
      || html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() || '';

    // Color swatches
    const colors: VariantColor[] = [];
    const swatches = [...html.matchAll(/<img[^>]+alt=["']([A-Za-z][^"']{1,20})["'][^>]*src=["']([^"']+)["']/gi)];
    const seenColors = new Set<string>();
    for (const sw of swatches) {
      const name = sw[1].trim();
      if (!name || seenColors.has(name)) continue;
      seenColors.add(name);
      colors.push({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        swatchUrl: sw[2],
        imageUrl: html.match(/class="ProductImage__image"[^>]+src="([^"]+)"/i)?.[1] || sw[2],
        price: 0,
        available: true,
        buyUrl: productUrl,
      });
    }

    // Size pills
    const sizes: VariantSize[] = [];
    const sizePills = [...html.matchAll(/>\s*([A-Z0-9]{1,5})\s*</g)];
    const seenSizes = new Set<string>();
    for (const sp of sizePills) {
      const label = sp[1].trim();
      if (!/^(XS|S|M|L|XL|XXL|XXXL|[0-9]{2,3})$/.test(label) || seenSizes.has(label)) continue;
      seenSizes.add(label);
      sizes.push({
        id: label,
        label,
        price: 0,
        available: true,
        buyUrl: productUrl,
      });
    }

    return { platform: 'Meesho', productId: productUrl, title, colors, sizes };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : '';
    console.error('[MeeshoVariants] fetch error:', msg);
    return null;
  }
}

// ─── Tata CLiQ variant fetcher ────────────────────────────────────────────────

async function fetchTataCliqVariants(productUrl: string): Promise<ProductVariants | null> {
  try {
    const url = scraperUrl(productUrl, { render: true });
    const { data: html } = await axios.get<string>(url, {
      timeout: 25000,
      transformResponse: [(r) => r],
    });
    if (typeof html !== 'string' || html.length < 500) return null;

    const title = html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim()
      || html.match(/class="[^"]*product-title[^"]*"[^>]*>([^<]+)</i)?.[1]?.trim() || '';
    const brand = html.match(/class="[^"]*brand-name[^"]*"[^>]*>([^<]+)</i)?.[1]?.trim()
      || html.match(/class="[^"]*brand[^"]*"[^>]*>([^<]+)</i)?.[1]?.trim() || '';

    // Color and size from rendered HTML
    const colors: VariantColor[] = [];
    const sizes: VariantSize[] = [];

    // Look for color variant buttons
    const colorBtns = [...html.matchAll(/data-variant-type=["']color["'][^>]*data-variant-value=["']([^"']+)["'][^>]*>/gi)];
    const seenColors = new Set<string>();
    for (const btn of colorBtns) {
      const name = btn[1].trim();
      if (!name || seenColors.has(name)) continue;
      seenColors.add(name);
      colors.push({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        imageUrl: '',
        price: 0,
        available: true,
        buyUrl: productUrl,
      });
    }

    const sizeBtns = [...html.matchAll(/data-variant-type=["']size["'][^>]*data-variant-value=["']([^"']+)["'][^>]*>/gi)];
    const seenSizes = new Set<string>();
    for (const btn of sizeBtns) {
      const label = btn[1].trim();
      if (!label || seenSizes.has(label)) continue;
      seenSizes.add(label);
      sizes.push({
        id: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        price: 0,
        available: true,
        buyUrl: productUrl,
      });
    }

    return { platform: 'Tata CLiQ', productId: productUrl, title, brand, colors, sizes };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : '';
    console.error('[TataCliqVariants] fetch error:', msg);
    return null;
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function fetchPlatformVariants(platform: string, productId: string): Promise<ProductVariants | null> {
  switch (platform) {
    case 'ajio': {
      const ajio = await fetchAjioVariants(productId);
      if (!ajio) return null;
      return {
        platform: 'Ajio',
        productId,
        title: '',
        brand: '',
        colors: ajio.colors.map(c => ({ id: c.colorCode, name: c.colorName, swatchUrl: c.swatchUrl, imageUrl: c.imageUrl, price: c.price, originalPrice: c.originalPrice, available: c.available, buyUrl: c.buyUrl })),
        sizes: ajio.sizes.map(s => ({ id: s.skuCode, label: s.sizeLabel, format: s.sizeFormat, price: s.price, originalPrice: s.originalPrice, available: s.available, buyUrl: s.buyUrl })),
      };
    }
    case 'amazon india':
    case 'amazon':
      return fetchAmazonVariants(productId);
    case 'flipkart':
      return fetchFlipkartVariants(productId);
    case 'myntra':
      return fetchMyntraVariants(productId);
    case 'meesho':
      return fetchMeeshoVariants(productId);
    case 'tata cliq':
    case 'tata_cliq':
      return fetchTataCliqVariants(productId);
    default:
      console.warn(`[Variants] unknown platform: ${platform}`);
      return null;
  }
}
