/**
 * Enhanced PlatformBadge for product card context.
 * Renders a color-coded circle badge with the platform's first letter.
 * Supports gold (#C9A96E) accent ring for lowest price indicator.
 *
 * Requirements: 3.8, 4.2, 4.4
 */

export interface PlatformBadgeProps {
  platform: string;
  size?: 'sm' | 'md'; // sm = 16px, md = 20px
  isLowest?: boolean; // Renders gold (#C9A96E) accent ring
  showName?: boolean;
  className?: string;
}

interface PlatformConfig {
  label: string;
  color: string;
  textColor: string;
}

/** Platform brand colors per design spec */
const PLATFORM_COLORS: Record<string, PlatformConfig> = {
  flipkart: { label: 'Flipkart', color: '#2874F0', textColor: '#FFFFFF' },
  myntra: { label: 'Myntra', color: '#FF3F6C', textColor: '#FFFFFF' },
  amazon: { label: 'Amazon', color: '#FF9900', textColor: '#FFFFFF' },
  meesho: { label: 'Meesho', color: '#570A57', textColor: '#FFFFFF' },
  ajio: { label: 'Ajio', color: '#3E3E3E', textColor: '#FFFFFF' },
};

/** Dimensions for each size variant */
const SIZE_MAP = {
  sm: 16,
  md: 20,
} as const;

/**
 * PlatformBadge renders a color-coded circle with the platform's initial letter.
 * When `isLowest` is true, a 2px gold ring wraps the badge.
 * Badges arrange horizontally with 4px spacing, max 5 visible in card context,
 * sorted by ascending price order (caller is responsible for sort order).
 */
export function PlatformBadge({
  platform,
  size = 'sm',
  isLowest = false,
  showName = false,
  className = '',
}: PlatformBadgeProps) {
  const key = platform.toLowerCase();
  const config = PLATFORM_COLORS[key];

  // Fallback for unknown platforms
  const bgColor = config?.color ?? '#6B7280';
  const textColor = config?.textColor ?? '#FFFFFF';
  const label = config?.label ?? platform.charAt(0).toUpperCase() + platform.slice(1);
  const initial = label.charAt(0).toUpperCase();

  const px = SIZE_MAP[size];
  // Font size scales with badge: ~55% of badge diameter
  const fontSize = Math.round(px * 0.55);

  // Gold accent ring: 2px ring around the badge
  const ringStyle = isLowest
    ? { boxShadow: '0 0 0 2px #C9A96E' }
    : undefined;

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={label}
    >
      <span
        role="img"
        aria-label={`${label}${isLowest ? ' (lowest price)' : ''}`}
        style={{
          width: `${px}px`,
          height: `${px}px`,
          backgroundColor: bgColor,
          color: textColor,
          fontSize: `${fontSize}px`,
          ...ringStyle,
        }}
        className="inline-flex items-center justify-center rounded-full font-bold leading-none shrink-0"
      >
        {initial}
      </span>
      {showName && (
        <span className="text-xs text-neutral-600 font-medium">
          {label}
        </span>
      )}
    </span>
  );
}

// ─── PlatformBadgeGroup ───
// Convenience wrapper that sorts offers by price, limits to 5, and renders badges

export interface PlatformOffer {
  platform: string;
  price: number;
}

export interface PlatformBadgeGroupProps {
  offers: PlatformOffer[];
  size?: 'sm' | 'md';
  maxVisible?: number;
  className?: string;
}

/**
 * Renders a horizontal row of PlatformBadges sorted by ascending price.
 * The lowest-priced badge gets the gold accent ring.
 * Limited to `maxVisible` (default 5) badges.
 */
export function PlatformBadgeGroup({
  offers,
  size = 'sm',
  maxVisible = 5,
  className = '',
}: PlatformBadgeGroupProps) {
  if (!offers || offers.length === 0) return null;

  // Sort by ascending price
  const sorted = [...offers].sort((a, b) => a.price - b.price);
  const visible = sorted.slice(0, maxVisible);

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label="Platform availability"
    >
      {visible.map((offer, index) => (
        <PlatformBadge
          key={offer.platform}
          platform={offer.platform}
          size={size}
          isLowest={index === 0}
          showName={false}
        />
      ))}
    </span>
  );
}

export default PlatformBadge;
