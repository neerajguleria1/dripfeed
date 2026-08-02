/**
 * SkeletonLoader — Premium skeleton placeholder matching ProductCard dimensions.
 * Displays shimmer animation with neutral-100 background on a 1.5s ease-in-out cycle.
 * Supports 'card', 'search-result', and 'discovery' variants.
 * Pre-allocates exact height to maintain zero CLS.
 *
 * @validates Requirements 1.2, 3.6, 5.4
 */

export interface SkeletonLoaderProps {
  count: number;
  variant: 'card' | 'search-result' | 'discovery';
}

const shimmerStyle = `
@keyframes skeleton-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

const shimmerClass: React.CSSProperties = {
  background: 'linear-gradient(90deg, #f5f5f5 25%, #e5e5e5 50%, #f5f5f5 75%)',
  backgroundSize: '800px 100%',
  animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
};

/**
 * Card variant skeleton — matches ProductCard: 3:4 image + content block.
 * Total pre-allocated height: aspect-[3/4] image + ~120px content.
 */
function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-neutral-100 flex flex-col">
      {/* Image area — 3:4 aspect ratio */}
      <div className="aspect-[3/4] w-full" style={shimmerClass} />

      {/* Content block — brand + title + price lines */}
      <div className="p-4 flex flex-col gap-2.5">
        {/* Brand line */}
        <div className="h-2.5 w-2/5 rounded" style={shimmerClass} />
        {/* Title line 1 */}
        <div className="h-3.5 w-full rounded" style={shimmerClass} />
        {/* Title line 2 */}
        <div className="h-3.5 w-3/4 rounded" style={shimmerClass} />
        {/* Price line */}
        <div className="h-5 w-1/3 rounded mt-1" style={shimmerClass} />
        {/* Platform badges */}
        <div className="flex gap-1 mt-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-4 w-4 rounded-full"
              style={shimmerClass}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Search-result variant — horizontal layout with image + text.
 * Pre-allocates 100px height for zero CLS.
 */
function SearchResultSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-white border border-neutral-100 flex flex-row h-[100px]">
      {/* Image area — square thumbnail */}
      <div className="w-[100px] h-[100px] shrink-0" style={shimmerClass} />

      {/* Content block */}
      <div className="p-3 flex flex-col gap-2 flex-1 justify-center">
        {/* Brand */}
        <div className="h-2.5 w-1/4 rounded" style={shimmerClass} />
        {/* Title */}
        <div className="h-3.5 w-3/4 rounded" style={shimmerClass} />
        {/* Price */}
        <div className="h-4 w-1/3 rounded" style={shimmerClass} />
      </div>
    </div>
  );
}

/**
 * Discovery variant — same structure as card but slightly smaller.
 * Reduced padding and smaller image area for denser feed layout.
 */
function DiscoverySkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-white border border-neutral-100 flex flex-col">
      {/* Image area — 3:4 aspect ratio (smaller container) */}
      <div className="aspect-[3/4] w-full" style={shimmerClass} />

      {/* Content block — compact */}
      <div className="p-3 flex flex-col gap-2">
        {/* Brand */}
        <div className="h-2 w-2/5 rounded" style={shimmerClass} />
        {/* Title */}
        <div className="h-3 w-full rounded" style={shimmerClass} />
        {/* Price */}
        <div className="h-4 w-1/3 rounded" style={shimmerClass} />
      </div>
    </div>
  );
}

/**
 * Maps variant to the appropriate skeleton component.
 */
function renderSkeleton(variant: SkeletonLoaderProps['variant'], index: number) {
  switch (variant) {
    case 'card':
      return <CardSkeleton key={index} />;
    case 'search-result':
      return <SearchResultSkeleton key={index} />;
    case 'discovery':
      return <DiscoverySkeleton key={index} />;
    default:
      return <CardSkeleton key={index} />;
  }
}

/**
 * Returns grid class based on variant to position skeletons correctly.
 */
function getGridClass(variant: SkeletonLoaderProps['variant']): string {
  switch (variant) {
    case 'card':
      return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3';
    case 'search-result':
      return 'flex flex-col gap-2';
    case 'discovery':
      return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3';
    default:
      return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3';
  }
}

export function SkeletonLoader({ count, variant }: SkeletonLoaderProps) {
  return (
    <>
      {/* Inject keyframes once */}
      <style>{shimmerStyle}</style>

      <div className={getGridClass(variant)} role="status" aria-label="Loading content">
        {Array.from({ length: count }, (_, i) => renderSkeleton(variant, i))}
      </div>
    </>
  );
}

export default SkeletonLoader;
