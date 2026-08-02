/**
 * Product validation utility for TagCheck.
 * Ensures only real products with valid platform URLs, non-Unsplash images,
 * and positive prices are displayed to users.
 *
 * This is the single enforcement point for seed data elimination.
 */

// ─── Interfaces ───

export interface PlatformOffer {
  platform: 'flipkart' | 'myntra' | 'amazon' | 'meesho' | 'ajio';
  price: number;
  originalPrice?: number;
  url: string;
  affiliateUrl?: string;
  imageUrl?: string;
  inStock?: boolean;
}

export interface ValidatedProduct {
  id: string;
  title: string;
  brand?: string;
  imageUrl: string;
  offers: PlatformOffer[];
  lowestPrice: number;
  highestPrice: number;
  highestOriginalPrice?: number;
  discountPercent?: number;
}

// ─── Constants ───

const ALLOWED_PLATFORMS = ['flipkart', 'myntra', 'amazon', 'meesho', 'ajio'] as const;

/**
 * Regex for valid platform URLs:
 * - Must start with https://
 * - Optional www. prefix
 * - One of the 5 allowed platform domains
 * - Must have a path segment after the domain (at least one character after /)
 */
const PLATFORM_URL_REGEX =
  /^https:\/\/(www\.)?(flipkart\.com|myntra\.com|amazon\.in|meesho\.com|ajio\.com)\/.+/;

const UNSPLASH_PATTERN = 'images.unsplash.com';

const MIN_TITLE_LENGTH = 5;

// ─── Exported Helpers ───

/**
 * Validates that a URL matches one of the allowed platform domains
 * and includes a product-specific path beyond the domain root.
 *
 * Exported for reuse in other modules (e.g., API endpoints, feed filters).
 */
export function isValidPlatformUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return PLATFORM_URL_REGEX.test(url);
}

// ─── Main Validation Function ───

/**
 * Validates a raw product object and returns a `ValidatedProduct` if all rules pass,
 * or `null` if any validation rule fails.
 *
 * Validation rules:
 * 1. `imageUrl` must NOT contain `images.unsplash.com`
 * 2. Every offer URL must match allowed platform domains with a non-empty path
 * 3. `lowestPrice` must be > 0
 * 4. `title` must be a non-empty string with at least 5 characters
 * 5. Must have at least one valid offer
 *
 * This is a pure function with no side effects.
 */
export function validateProduct(raw: unknown): ValidatedProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawObj = raw as Record<string, unknown>;

  // Validate title (min 5 characters)
  const title = rawObj.title;
  if (!title || typeof title !== 'string' || title.trim().length < MIN_TITLE_LENGTH) {
    return null;
  }

  // Validate imageUrl — reject Unsplash images
  const imageUrl = rawObj.imageUrl;
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  if (imageUrl.includes(UNSPLASH_PATTERN)) return null;

  // Validate offers array exists and is non-empty
  const rawOffers = (rawObj.offers ?? rawObj.platforms) as unknown[];
  if (!Array.isArray(rawOffers) || rawOffers.length === 0) return null;

  // Validate each offer
  const validOffers: PlatformOffer[] = [];
  for (const offerRaw of rawOffers) {
    if (!offerRaw || typeof offerRaw !== 'object') continue;
    const offer = offerRaw as Record<string, unknown>;

    // Validate platform
    const platform = offer.platform as string;
    if (!ALLOWED_PLATFORMS.includes(platform as typeof ALLOWED_PLATFORMS[number])) continue;

    // Validate URL — must be a valid platform URL with path
    const url = offer.url;
    if (typeof url !== 'string' || !isValidPlatformUrl(url)) continue;

    // Validate price — must be positive
    const price = offer.price;
    if (typeof price !== 'number' || price <= 0) continue;

    validOffers.push({
      platform: platform as PlatformOffer['platform'],
      price,
      originalPrice: typeof offer.originalPrice === 'number' && offer.originalPrice > 0
        ? offer.originalPrice
        : undefined,
      url,
      affiliateUrl: typeof offer.affiliateUrl === 'string' ? offer.affiliateUrl : undefined,
      imageUrl: typeof offer.imageUrl === 'string' ? offer.imageUrl : undefined,
      inStock: typeof offer.inStock === 'boolean' ? offer.inStock : undefined,
    });
  }

  // Must have at least one valid offer
  if (validOffers.length === 0) return null;

  // Compute price aggregates
  const prices = validOffers.map((o) => o.price);
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);

  // Reject if lowest price is not positive
  if (lowestPrice <= 0) return null;

  // Compute highest original price across all offers
  const originalPrices = validOffers
    .map((o) => o.originalPrice)
    .filter((p): p is number => typeof p === 'number' && p > 0);
  const highestOriginalPrice = originalPrices.length > 0 ? Math.max(...originalPrices) : undefined;

  // Compute discount percent
  let discountPercent: number | undefined;
  if (highestOriginalPrice && highestOriginalPrice > lowestPrice) {
    discountPercent = Math.floor(
      ((highestOriginalPrice - lowestPrice) / highestOriginalPrice) * 100
    );
  }

  // Build validated product
  const id = rawObj.id ?? rawObj._id ?? `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: String(id),
    title: title.trim(),
    brand: typeof rawObj.brand === 'string' ? rawObj.brand : undefined,
    imageUrl,
    offers: validOffers,
    lowestPrice,
    highestPrice,
    highestOriginalPrice,
    discountPercent,
  };
}
