// ─── Filter State ─────────────────────────────────────────────────────────────

export interface FilterState {
  // Multi-select
  platforms: string[];
  brands: string[];
  colors: string[];
  sizes: string[];
  // Range
  priceMin: number;
  priceMax: number;
  pricePreset: string; // 'all' | 'under500' | '500-1000' | '1000-2000' | '2000-5000' | '5000+'
  // Threshold
  minDiscount: number;
  minRating: number;
  // Boolean
  inStockOnly: boolean;
  // Sort
  sort: SortOption;
}

export type SortOption =
  | 'relevance'
  | 'popularity'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'discount-desc'
  | 'price-history-low'
  | 'best-value';

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_FILTERS: FilterState = {
  platforms:   [],
  brands:      [],
  colors:      [],
  sizes:       [],
  priceMin:    0,
  priceMax:    0,
  pricePreset: 'all',
  minDiscount: 0,
  minRating:   0,
  inStockOnly: false,
  sort:        'relevance',
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance',        label: 'Relevance' },
  { value: 'popularity',       label: 'Popularity' },
  { value: 'newest',           label: 'Newest' },
  { value: 'price-asc',        label: 'Lowest Price' },
  { value: 'price-desc',       label: 'Highest Price' },
  { value: 'discount-desc',    label: 'Highest Discount' },
  { value: 'price-history-low',label: 'Price History Low' },
  { value: 'best-value',       label: 'Best Value' },
];

export const PRICE_PRESETS: { value: string; label: string; min: number; max: number }[] = [
  { value: 'all',       label: 'All',        min: 0,    max: 0 },
  { value: 'under500',  label: 'Under ₹500', min: 0,    max: 499 },
  { value: '500-1000',  label: '₹500–1K',    min: 500,  max: 1000 },
  { value: '1000-2000', label: '₹1K–2K',     min: 1000, max: 2000 },
  { value: '2000-5000', label: '₹2K–5K',     min: 2000, max: 5000 },
  { value: '5000+',     label: '₹5K+',       min: 5000, max: 0 },
];

export const DISCOUNT_OPTIONS: { value: number; label: string }[] = [
  { value: 0,  label: 'Any' },
  { value: 10, label: '10%+' },
  { value: 20, label: '20%+' },
  { value: 30, label: '30%+' },
  { value: 50, label: '50%+' },
  { value: 70, label: '70%+' },
];

export const RATING_OPTIONS: { value: number; label: string }[] = [
  { value: 0,   label: 'Any' },
  { value: 3,   label: '3★+' },
  { value: 3.5, label: '3.5★+' },
  { value: 4,   label: '4★+' },
  { value: 4.5, label: '4.5★+' },
];

// ─── URL serialisation ────────────────────────────────────────────────────────
// Only non-default values are written to the URL to keep it clean.

export function filtersToParams(f: FilterState): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.platforms.length)   p.platforms   = f.platforms.join(',');
  if (f.brands.length)      p.brands      = f.brands.join(',');
  if (f.colors.length)      p.colors      = f.colors.join(',');
  if (f.sizes.length)       p.sizes       = f.sizes.join(',');
  if (f.pricePreset !== 'all') p.pricePreset = f.pricePreset;
  if (f.priceMin > 0)       p.priceMin    = String(f.priceMin);
  if (f.priceMax > 0)       p.priceMax    = String(f.priceMax);
  if (f.minDiscount > 0)    p.minDiscount = String(f.minDiscount);
  if (f.minRating > 0)      p.minRating   = String(f.minRating);
  if (f.inStockOnly)        p.inStock     = '1';
  if (f.sort !== 'relevance') p.sort      = f.sort;
  return p;
}

export function paramsToFilters(params: URLSearchParams): FilterState {
  const split = (key: string) => {
    const v = params.get(key);
    return v ? v.split(',').filter(Boolean) : [];
  };
  const num = (key: string, fallback = 0) => {
    const v = parseFloat(params.get(key) ?? '');
    return Number.isFinite(v) ? v : fallback;
  };
  const sort = params.get('sort') as SortOption | null;
  const validSort = SORT_OPTIONS.some(o => o.value === sort);
  return {
    platforms:   split('platforms'),
    brands:      split('brands'),
    colors:      split('colors'),
    sizes:       split('sizes'),
    pricePreset: params.get('pricePreset') || 'all',
    priceMin:    num('priceMin'),
    priceMax:    num('priceMax'),
    minDiscount: num('minDiscount'),
    minRating:   num('minRating'),
    inStockOnly: params.get('inStock') === '1',
    sort:        validSort ? (sort as SortOption) : 'relevance',
  };
}

export function isDefaultFilters(f: FilterState): boolean {
  return (
    f.platforms.length === 0 &&
    f.brands.length === 0 &&
    f.colors.length === 0 &&
    f.sizes.length === 0 &&
    f.pricePreset === 'all' &&
    f.priceMin === 0 &&
    f.priceMax === 0 &&
    f.minDiscount === 0 &&
    f.minRating === 0 &&
    !f.inStockOnly &&
    f.sort === 'relevance'
  );
}

export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.platforms.length)      n += f.platforms.length;
  if (f.brands.length)         n += f.brands.length;
  if (f.colors.length)         n += f.colors.length;
  if (f.sizes.length)          n += f.sizes.length;
  if (f.pricePreset !== 'all') n++;
  if (f.priceMin > 0 || f.priceMax > 0) n++;
  if (f.minDiscount > 0)       n++;
  if (f.minRating > 0)         n++;
  if (f.inStockOnly)           n++;
  return n;
}

// ─── Product shape used by filter/sort functions ──────────────────────────────

export interface FilterableProduct {
  id: string;
  title: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating?: number;
  platform: string;
  color?: string;
  size?: string;
  /** Unix ms — used for 'newest' sort. Populated from fetchedAt when available. */
  fetchedAt?: number;
  /** All-time lowest price from PriceHistory — populated lazily. */
  priceHistoryLow?: number;
  /** inStock flag — true when platform confirms availability. */
  inStock?: boolean;
}

// ─── Pure filter function ─────────────────────────────────────────────────────

export function applyFilters<T extends FilterableProduct>(
  products: T[],
  f: FilterState,
): T[] {
  return products.filter(p => {
    // Platform
    if (f.platforms.length && !f.platforms.some(pl => pl.toLowerCase() === p.platform.toLowerCase())) return false;

    // Brand
    if (f.brands.length && !f.brands.some(b => b.toLowerCase() === (p.brand ?? '').toLowerCase())) return false;

    // Color
    if (f.colors.length && !f.colors.some(c => c.toLowerCase() === (p.color ?? '').toLowerCase())) return false;

    // Size
    if (f.sizes.length && !f.sizes.some(s => s.toLowerCase() === (p.size ?? '').toLowerCase())) return false;

    // Price — custom range takes precedence over preset
    if (f.priceMin > 0 || f.priceMax > 0) {
      if (f.priceMin > 0 && p.price < f.priceMin) return false;
      if (f.priceMax > 0 && p.price > f.priceMax) return false;
    } else if (f.pricePreset !== 'all') {
      const preset = PRICE_PRESETS.find(pr => pr.value === f.pricePreset);
      if (preset) {
        if (preset.min > 0 && p.price < preset.min) return false;
        if (preset.max > 0 && p.price > preset.max) return false;
      }
    }

    // Discount
    if (f.minDiscount > 0 && (p.discount ?? 0) < f.minDiscount) return false;

    // Rating
    if (f.minRating > 0 && (p.rating ?? 0) < f.minRating) return false;

    // Availability
    if (f.inStockOnly && p.inStock === false) return false;

    return true;
  });
}

// ─── Pure sort function ───────────────────────────────────────────────────────

export function applySort<T extends FilterableProduct>(products: T[], sort: SortOption): T[] {
  const arr = [...products];
  switch (sort) {
    case 'price-asc':
      return arr.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return arr.sort((a, b) => b.price - a.price);
    case 'discount-desc':
      return arr.sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
    case 'newest':
      return arr.sort((a, b) => (b.fetchedAt ?? 0) - (a.fetchedAt ?? 0));
    case 'price-history-low':
      // Products with a known history low first (ascending), unknowns last
      return arr.sort((a, b) => {
        const al = a.priceHistoryLow ?? Infinity;
        const bl = b.priceHistoryLow ?? Infinity;
        return al - bl;
      });
    case 'best-value':
      // Score = discount% * 0.6 + (rating/5) * 0.4 — higher is better
      return arr.sort((a, b) => {
        const scoreA = (a.discount ?? 0) * 0.6 + ((a.rating ?? 0) / 5) * 40;
        const scoreB = (b.discount ?? 0) * 0.6 + ((b.rating ?? 0) / 5) * 40;
        return scoreB - scoreA;
      });
    case 'popularity':
    case 'relevance':
    default:
      return arr; // preserve server order
  }
}

// ─── Combined apply ───────────────────────────────────────────────────────────

export function applyFiltersAndSort<T extends FilterableProduct>(
  products: T[],
  f: FilterState,
): T[] {
  return applySort(applyFilters(products, f), f.sort);
}

// ─── Facet extraction ─────────────────────────────────────────────────────────
// Derives available filter options from the current result set.

export interface Facets {
  platforms: string[];
  brands: string[];
  colors: string[];
  sizes: string[];
  maxPrice: number;
  minPrice: number;
}

export function extractFacets<T extends FilterableProduct>(products: T[]): Facets {
  const platforms = new Set<string>();
  const brands    = new Set<string>();
  const colors    = new Set<string>();
  const sizes     = new Set<string>();
  let minPrice = Infinity;
  let maxPrice = 0;

  for (const p of products) {
    if (p.platform) platforms.add(p.platform);
    if (p.brand)    brands.add(p.brand);
    if (p.color)    colors.add(p.color);
    if (p.size) {
      // Sizes can be comma-separated (e.g. "S/M/L")
      p.size.split('/').forEach(s => { if (s.trim()) sizes.add(s.trim()); });
    }
    if (p.price > 0) {
      if (p.price < minPrice) minPrice = p.price;
      if (p.price > maxPrice) maxPrice = p.price;
    }
  }

  return {
    platforms: Array.from(platforms).sort(),
    brands:    Array.from(brands).sort(),
    colors:    Array.from(colors).sort(),
    sizes:     Array.from(sizes).sort(),
    minPrice:  minPrice === Infinity ? 0 : minPrice,
    maxPrice,
  };
}
