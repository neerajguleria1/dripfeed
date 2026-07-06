/**
 * Premium skeleton loader — shaped exactly like ProductCard layout.
 * Not generic rectangles — mirrors real card structure.
 */
export function ProductSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_24px_-8px_rgba(0,0,0,0.08)] animate-pulse">
      {/* Image placeholder — same 3:4 aspect as real cards */}
      <div className="aspect-[3/4] w-full bg-neutral-100" />

      {/* Content area */}
      <div className="p-4 space-y-3">
        {/* Brand */}
        <div className="h-2.5 w-2/5 rounded bg-neutral-200" />
        {/* Title */}
        <div className="h-3.5 w-4/5 rounded bg-neutral-200" />
        {/* Price — slightly darker to signal importance */}
        <div className="h-5 w-1/3 rounded bg-neutral-300" />
        {/* Platform dots */}
        <div className="flex gap-1.5 pt-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProductSkeleton;
