import { useState, useCallback } from 'react';
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  PRICE_PRESETS,
  DISCOUNT_OPTIONS,
  RATING_OPTIONS,
  SORT_OPTIONS,
  countActiveFilters,
  type FilterState,
  type Facets,
} from '../../types/filters';
import { formatPrice } from '../../utils/formatPrice';

export type { FilterState };

export interface SearchFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
  facets: Facets;
  resultCount?: number;
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap border transition-all duration-150 min-h-[36px]',
        active
          ? 'text-white border-transparent shadow-sm'
          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300',
      ].join(' ')}
      style={active ? { backgroundColor: color || '#0F0F1A' } : undefined}
    >
      {label}
      {active && <X className="w-2.5 h-2.5 opacity-70" />}
    </button>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-neutral-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full py-3 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
          {label}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
        )}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

// ─── Platform color map ───────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  'myntra':       '#FF3F6C',
  'ajio':         '#1A1A1A',
  'amazon india': '#FF9900',
  'flipkart':     '#2874F0',
  'meesho':       '#570741',
  'nykaa':        '#FC2779',
  'tata cliq':    '#6C3D9E',
};

function platformColor(name: string) {
  return PLATFORM_COLORS[name.toLowerCase()] || '#6b7280';
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SearchFilters({
  filters,
  onFilterChange,
  onReset,
  facets,
  resultCount,
}: SearchFiltersProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const toggle = useCallback(
    <K extends 'platforms' | 'brands' | 'colors' | 'sizes'>(
      key: K,
      value: string,
    ) => {
      const current = filters[key] as string[];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      onFilterChange({ ...filters, [key]: next });
    },
    [filters, onFilterChange],
  );

  const set = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      onFilterChange({ ...filters, [key]: value });
    },
    [filters, onFilterChange],
  );

  // ── Sort bar (always visible) ──────────────────────────────────────────────
  const sortBar = (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
      {SORT_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => set('sort', opt.value)}
          className={[
            'px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap border transition-all duration-150 min-h-[36px]',
            filters.sort === opt.value
              ? 'bg-[#0F0F1A] text-white border-transparent'
              : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  // ── Filter toggle button ───────────────────────────────────────────────────
  const filterToggle = (
    <button
      type="button"
      onClick={() => setPanelOpen(o => !o)}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all duration-150 min-h-[36px] shrink-0',
        activeCount > 0
          ? 'bg-[#C9A96E] text-[#171310] border-transparent'
          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300',
      ].join(' ')}
    >
      <SlidersHorizontal className="w-3 h-3" />
      Filters
      {activeCount > 0 && (
        <span className="bg-[#171310] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {activeCount}
        </span>
      )}
    </button>
  );

  // ── Active filter chips (quick-remove) ────────────────────────────────────
  const activeChips: React.ReactNode[] = [];
  filters.platforms.forEach(p =>
    activeChips.push(
      <Chip key={`pl-${p}`} label={p} active onClick={() => toggle('platforms', p)} color={platformColor(p)} />,
    ),
  );
  filters.brands.forEach(b =>
    activeChips.push(<Chip key={`br-${b}`} label={b} active onClick={() => toggle('brands', b)} />),
  );
  filters.colors.forEach(c =>
    activeChips.push(<Chip key={`co-${c}`} label={c} active onClick={() => toggle('colors', c)} />),
  );
  filters.sizes.forEach(s =>
    activeChips.push(<Chip key={`sz-${s}`} label={s} active onClick={() => toggle('sizes', s)} />),
  );
  if (filters.pricePreset !== 'all') {
    const preset = PRICE_PRESETS.find(p => p.value === filters.pricePreset);
    if (preset)
      activeChips.push(
        <Chip key="price" label={preset.label} active onClick={() => set('pricePreset', 'all')} />,
      );
  }
  if (filters.priceMin > 0 || filters.priceMax > 0) {
    const label = `${filters.priceMin > 0 ? formatPrice(filters.priceMin) : '₹0'}–${filters.priceMax > 0 ? formatPrice(filters.priceMax) : '∞'}`;
    activeChips.push(
      <Chip
        key="custom-price"
        label={label}
        active
        onClick={() => onFilterChange({ ...filters, priceMin: 0, priceMax: 0 })}
      />,
    );
  }
  if (filters.minDiscount > 0)
    activeChips.push(
      <Chip key="disc" label={`${filters.minDiscount}%+ off`} active onClick={() => set('minDiscount', 0)} />,
    );
  if (filters.minRating > 0)
    activeChips.push(
      <Chip key="rat" label={`${filters.minRating}★+`} active onClick={() => set('minRating', 0)} />,
    );
  if (filters.inStockOnly)
    activeChips.push(
      <Chip key="stock" label="In Stock" active onClick={() => set('inStockOnly', false)} />,
    );

  return (
    <div className="space-y-2">
      {/* ── Top bar: sort + filter toggle ── */}
      <div className="flex items-center gap-2">
        {filterToggle}
        <div className="flex-1 overflow-x-auto scrollbar-hide">{sortBar}</div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors whitespace-nowrap"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Active filter chips ── */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips}
        </div>
      )}

      {/* ── Result count ── */}
      {resultCount !== undefined && (
        <p className="text-[11px] text-neutral-400">
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Expandable filter panel ── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 mt-1 space-y-0">

              {/* Platform */}
              {facets.platforms.length > 0 && (
                <Section label="Platform">
                  <div className="flex flex-wrap gap-1.5">
                    {facets.platforms.map(p => (
                      <Chip
                        key={p}
                        label={p}
                        active={filters.platforms.includes(p)}
                        onClick={() => toggle('platforms', p)}
                        color={platformColor(p)}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Brand */}
              {facets.brands.length > 0 && (
                <Section label="Brand">
                  <div className="flex flex-wrap gap-1.5">
                    {facets.brands.slice(0, 20).map(b => (
                      <Chip
                        key={b}
                        label={b}
                        active={filters.brands.includes(b)}
                        onClick={() => toggle('brands', b)}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Price */}
              <Section label="Price">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {PRICE_PRESETS.map(pr => (
                      <Chip
                        key={pr.value}
                        label={pr.label}
                        active={filters.pricePreset === pr.value && filters.priceMin === 0 && filters.priceMax === 0}
                        onClick={() => onFilterChange({ ...filters, pricePreset: pr.value, priceMin: 0, priceMax: 0 })}
                      />
                    ))}
                  </div>
                  {/* Custom range */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Min ₹"
                      value={filters.priceMin || ''}
                      onChange={e => onFilterChange({ ...filters, priceMin: Number(e.target.value) || 0, pricePreset: 'all' })}
                      className="w-24 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[#C9A96E]"
                    />
                    <span className="text-neutral-400 text-[12px]">–</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="Max ₹"
                      value={filters.priceMax || ''}
                      onChange={e => onFilterChange({ ...filters, priceMax: Number(e.target.value) || 0, pricePreset: 'all' })}
                      className="w-24 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[#C9A96E]"
                    />
                  </div>
                </div>
              </Section>

              {/* Discount */}
              <Section label="Discount">
                <div className="flex flex-wrap gap-1.5">
                  {DISCOUNT_OPTIONS.map(d => (
                    <Chip
                      key={d.value}
                      label={d.label}
                      active={filters.minDiscount === d.value}
                      onClick={() => set('minDiscount', d.value)}
                    />
                  ))}
                </div>
              </Section>

              {/* Color */}
              {facets.colors.length > 0 && (
                <Section label="Color" defaultOpen={false}>
                  <div className="flex flex-wrap gap-1.5">
                    {facets.colors.map(c => (
                      <Chip
                        key={c}
                        label={c}
                        active={filters.colors.includes(c)}
                        onClick={() => toggle('colors', c)}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Size */}
              {facets.sizes.length > 0 && (
                <Section label="Size" defaultOpen={false}>
                  <div className="flex flex-wrap gap-1.5">
                    {facets.sizes.map(s => (
                      <Chip
                        key={s}
                        label={s}
                        active={filters.sizes.includes(s)}
                        onClick={() => toggle('sizes', s)}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Rating */}
              <Section label="Rating" defaultOpen={false}>
                <div className="flex flex-wrap gap-1.5">
                  {RATING_OPTIONS.map(r => (
                    <Chip
                      key={r.value}
                      label={r.label}
                      active={filters.minRating === r.value}
                      onClick={() => set('minRating', r.value)}
                    />
                  ))}
                </div>
              </Section>

              {/* Availability */}
              <Section label="Availability" defaultOpen={false}>
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    label="In Stock Only"
                    active={filters.inStockOnly}
                    onClick={() => set('inStockOnly', !filters.inStockOnly)}
                  />
                </div>
              </Section>

              {/* Reset */}
              {countActiveFilters(filters) > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => { onReset(); setPanelOpen(false); }}
                    className="w-full py-2.5 rounded-xl border border-neutral-200 text-[12px] font-medium text-neutral-600 hover:border-neutral-300 transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SearchFilters;
