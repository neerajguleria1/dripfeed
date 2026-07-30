/**
 * productVariant.ts
 *
 * Hierarchical variant type for Ajio products, derived from the verified
 * /api/p/{colorCode} response structure.
 *
 * ── Verified Ajio data model ──────────────────────────────────────────────────
 *
 *   GET /api/p/{colorCode}          e.g. /api/p/460886329_white
 *
 *   baseOptions[0].options[]        → one entry per available COLOR
 *     .code                         → colorCode  e.g. "460886329_white"
 *     .color                        → color name e.g. "WHITE"
 *     .url                          → color-level page URL
 *     .priceData.value              → price for this color
 *     .stock                        → color-level stock
 *     .variantOptionQualifiers[]    → includes swatch image URL
 *     .modelImage.url               → product image for this color
 *
 *   variantOptions[]                → one entry per SIZE for the REQUESTED color
 *     .code                         → full SKU  e.g. "460886329003"
 *     .url                          → SKU-level page URL (direct buy link)
 *     .priceData.value              → price for this SKU
 *     .stock.stockLevelStatus       → "inStock" | "outOfStock"
 *     .stock.stockLevel             → numeric quantity
 *     .variantOptionQualifiers[]    → includes size qualifier
 *     .scDisplaySize                → display size label e.g. "7" (in displaySizeFormat units)
 *     .displaySizeFormat            → "UK" | "EU" | etc.
 *     .modelImage.url               → image (same as color image for this color)
 *
 * ── Hierarchy ─────────────────────────────────────────────────────────────────
 *
 *   AjioProductVariants             ← root, one per /api/p/ call
 *     .colorCode                    ← the colorCode used to fetch (e.g. "460886329_white")
 *     .baseProduct                  ← base product code (e.g. "460886329")
 *     .colors[]                     ← all available colors (from baseOptions)
 *     .sizes[]                      ← all sizes for the FETCHED color (from variantOptions)
 *
 *   AjioColorVariant                ← one per color
 *     .colorCode                    ← e.g. "460886329_white"
 *     .colorName                    ← e.g. "White"
 *     .swatchUrl                    ← swatch image URL
 *     .imageUrl                     ← model/product image URL
 *     .price                        ← color-level price
 *     .originalPrice                ← MRP if higher than price
 *     .available                    ← color-level stock flag
 *     .buyUrl                       ← color-level page URL
 *
 *   AjioSizeVariant                 ← one per size SKU (scoped to fetched color)
 *     .skuCode                      ← full SKU e.g. "460886329003"
 *     .sizeLabel                    ← display label e.g. "7"
 *     .sizeFormat                   ← e.g. "UK"
 *     .price                        ← SKU-level price
 *     .originalPrice                ← MRP if higher than price
 *     .available                    ← true when stockLevelStatus === "inStock"
 *     .stockLevel                   ← numeric quantity
 *     .buyUrl                       ← direct SKU page URL (the correct buy link)
 *     .imageUrl                     ← product image (same as parent color's image)
 */

// ─── Generic (platform-agnostic) types ─────────────────────────────────────────

export interface VariantColor {
  id: string;
  name: string;
  swatchUrl?: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  available: boolean;
  buyUrl: string;
}

export interface VariantSize {
  id: string;
  label: string;
  format?: string;
  price: number;
  originalPrice?: number;
  available: boolean;
  buyUrl: string;
}

export interface ProductVariants {
  platform: string;
  productId: string;
  title?: string;
  brand?: string;
  colors: VariantColor[];
  sizes: VariantSize[];
}

/** One color option for a product — from baseOptions[0].options[] */
export interface AjioColorVariant {
  /** colorCode e.g. "460886329_white" — use as input to /api/p/{colorCode} */
  readonly colorCode: string;
  /** Human-readable color name, title-cased e.g. "White", "Navy Blue" */
  readonly colorName: string;
  /** Swatch thumbnail URL (https://) */
  readonly swatchUrl: string;
  /** Full product image URL for this color (https://) */
  readonly imageUrl: string;
  /** Selling price in INR */
  readonly price: number;
  /** MRP in INR — undefined when absent or equal to price */
  readonly originalPrice: number | undefined;
  /** Whether this color is in stock at the color level */
  readonly available: boolean;
  /** Color-level page URL (https://) */
  readonly buyUrl: string;
}

/** One size SKU for the fetched color — from variantOptions[] */
export interface AjioSizeVariant {
  /** Full SKU code e.g. "460886329003" */
  readonly skuCode: string;
  /** Display size label e.g. "7", "8", "M", "XL" */
  readonly sizeLabel: string;
  /** Size system e.g. "UK", "EU", "US" */
  readonly sizeFormat: string;
  /** Selling price in INR for this SKU */
  readonly price: number;
  /** MRP in INR — undefined when absent or equal to price */
  readonly originalPrice: number | undefined;
  /** true when stockLevelStatus === "inStock" */
  readonly available: boolean;
  /** Numeric stock quantity */
  readonly stockLevel: number;
  /**
   * Direct buy URL for this exact color+size SKU (https://).
   * This is the URL to open when a user selects this color AND this size.
   */
  readonly buyUrl: string;
  /** Product image URL — same as the parent color's imageUrl */
  readonly imageUrl: string;
}

/**
 * Root type returned by parseAjioPdpResponse / fetchAjioVariants.
 *
 * Represents the full variant data for one /api/p/{colorCode} call:
 *   - colors: all available colors for this product (from baseOptions)
 *   - sizes:  all sizes for the FETCHED color only (from variantOptions)
 *
 * To get sizes for a different color, call /api/p/{otherColorCode}.
 */
export interface AjioProductVariants {
  /** The colorCode used to fetch this data e.g. "460886329_white" */
  readonly colorCode: string;
  /** Base product code e.g. "460886329" */
  readonly baseProduct: string;
  /** All available colors for this product */
  readonly colors: readonly AjioColorVariant[];
  /** All sizes for the fetched color, each with its own SKU and buy URL */
  readonly sizes: readonly AjioSizeVariant[];
}
