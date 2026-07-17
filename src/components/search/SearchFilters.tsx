
export interface FilterState {
  platforms: string[];
  priceRange: string;
  category: string;
  minDiscount: number;
  sort: 'price-asc' | 'discount-desc' | 'newest' | 'platform';
}

export interface SearchFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  resultCount?: number;
  platformsSearched?: string[];
}

const PLATFORMS = [
  { name: 'Ajio', color: '#000000' },
  { name: 'Amazon India', color: '#FF9900' },
  { name: 'Flipkart', color: '#2874F0' },
  { name: 'Meesho', color: '#570A57' },
];

const PRICE_RANGES = [
  { value: 'all', label: 'All' },
  { value: 'under500', label: 'Under ₹500' },
  { value: '500-1000', label: '₹500-1K' },
  { value: '1000-2000', label: '₹1K-2K' },
  { value: '2000-5000', label: '₹2K-5K' },
  { value: '5000+', label: '₹5K+' },
];

const DISCOUNT_OPTIONS = [
  { value: 0, label: 'All' },
  { value: 10, label: '10%+' },
  { value: 20, label: '20%+' },
  { value: 30, label: '30%+' },
  { value: 50, label: '50%+' },
];

export function SearchFilters({
  filters,
  onFilterChange,
  resultCount,
  platformsSearched,
}: SearchFiltersProps) {
  function togglePlatform(platform: string) {
    const current = filters.platforms;
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    onFilterChange({ ...filters, platforms: next });
  }

  function setPriceRange(range: string) {
    onFilterChange({ ...filters, priceRange: range });
  }

  function setDiscount(min: number) {
    onFilterChange({ ...filters, minDiscount: min });
  }

  return (
    <div className="space-y-3">
      {/* Result summary */}
      {resultCount !== undefined && (
        <p className="text-sm text-[var(--df-accent-navy)]/60">
          {resultCount} {resultCount !== 1 ? 'results' : 'result'}
          {platformsSearched && platformsSearched.length > 0 &&
            ` across ${platformsSearched.length} ${platformsSearched.length !== 1 ? 'platforms' : 'platform'}`
          }
        </p>
      )}

      {/* Platform chips */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {PLATFORMS.map((p) => {
            const active = filters.platforms.includes(p.name);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => togglePlatform(p.name)}
                className={[
                  'px-3 py-2 sm:py-1.5 rounded-full text-[13px] sm:text-xs font-medium transition-all duration-150 whitespace-nowrap border min-h-[44px] sm:min-h-0',
                  active
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                ].join(' ')}
                style={active ? { backgroundColor: p.color } : undefined}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price range chips */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 min-w-max items-center">
          <span className="text-[13px] sm:text-xs text-gray-400 font-medium mr-1">Price:</span>
          {PRICE_RANGES.map((r) => {
            const active = filters.priceRange === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setPriceRange(r.value)}
                className={[
                  'px-3 py-2 sm:py-1.5 rounded-full text-[13px] sm:text-xs font-medium transition-all duration-150 whitespace-nowrap border min-h-[44px] sm:min-h-0',
                  active
                    ? 'bg-[var(--df-accent-navy)] text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Discount chips + Sort */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 min-w-max items-center">
          <span className="text-[13px] sm:text-xs text-gray-400 font-medium mr-1">Discount:</span>
          {DISCOUNT_OPTIONS.map((d) => {
            const active = filters.minDiscount === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setDiscount(d.value)}
                className={[
                  'px-3 py-2 sm:py-1.5 rounded-full text-[13px] sm:text-xs font-medium transition-all duration-150 whitespace-nowrap border min-h-[44px] sm:min-h-0',
                  active
                    ? 'bg-[var(--df-accent-navy)] text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                {d.label}
              </button>
            );
          })}


        </div>
      </div>
    </div>
  );
}

export default SearchFilters;
