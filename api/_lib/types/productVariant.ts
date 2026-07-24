/**
 * productVariant.ts
 *
 * Type definitions for platform-specific product variant data.
 *
 * A ProductVariant represents one specific combination of color + size
 * for a single platform listing. It is fetched on demand from the
 * platform's product detail page — never from search results.
 *
 * ── Design rules ──────────────────────────────────────────────────────────────
 *   • Completely independent from SearchProduct, NormalizedProduct,
 *     CanonicalProduct, and the matching pipeline.
 *   • Never stored in the search cache — has its own cache key space.
 *   • Never sent to the frontend as part of a search response — only
 *     returned when explicitly requested for a specific product.
 *   • buyUrl is always the variant-specific URL, never the parent product URL.
 *     Clicking Buy on a White/UK9 variant must open the White/UK9 page,
 *     not the parent page that defaults to whatever color Ajio chose.
 */

export interface ProductVariant {
  /**
   * Platform-specific identifier for this exact variant.
   *
   * For Ajio: the colorGroup string (e.g. "469486197_white").
   * For Flipkart: the item ID from the product URL.
   * For Myntra: the productId of the color variant.
   *
   * Unique within a platform for a given parent product.
   * NOT globally unique across platforms.
   */
  readonly variantId: string;

  /**
   * Human-readable color name for this variant.
   * Title-cased (e.g. "Navy Blue", "Off White").
   * undefined when the platform does not expose a structured color field.
   */
  readonly color: string | undefined;

  /**
   * Size label for this variant (e.g. "UK 8", "M", "XL").
   * undefined when this variant entry represents a color (not a size).
   *
   * Note: Ajio's PDP returns sizes as a flat list under the parent product,
   * not nested under each color variant. A color variant and a size entry
   * are separate concepts in Ajio's data model.
   */
  readonly size: string | undefined;

  /**
   * Image URL for this specific variant.
   * Always https://. Always the variant's own image, not the parent's.
   */
  readonly imageUrl: string;

  /**
   * Current selling price in INR (paise-free integer).
   */
  readonly price: number;

  /**
   * MRP / original price in INR. undefined when not provided or equal to price.
   */
  readonly originalPrice: number | undefined;

  /**
   * Variant-specific product page URL.
   * Navigating to this URL opens the exact color/size combination.
   * Always absolute (https://...).
   */
  readonly buyUrl: string;

  /**
   * Whether this variant is currently in stock.
   * false when the platform explicitly marks it as out of stock.
   * Defaults to true when availability data is absent (optimistic).
   */
  readonly available: boolean;
}
