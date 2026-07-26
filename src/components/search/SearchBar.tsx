import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { Search, ArrowRight, Clock, TrendingUp, Tag, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAutocomplete } from '../../hooks/useAutocomplete';
import { formatPrice } from '../../utils/formatPrice';

export interface SearchBarProps {
  size?: 'default' | 'hero' | 'lg';
  initialQuery?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-semibold text-[#C9A96E]">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchBar({
  size = 'default',
  initialQuery = '',
  onSearch,
  className = '',
}: SearchBarProps) {
  const navigate = useNavigate();
  const listboxId = useId();

  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, status, recentSearches, addRecentSearch, clearRecentSearches, fetch, cancel } =
    useAutocomplete();

  const isHero = size === 'hero';
  const isLg = size === 'lg';

  // Sync when parent changes initialQuery (e.g. navigating to search page)
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);

  // Build flat list of selectable items for keyboard navigation
  const items = buildItems(query, data, recentSearches);

  const handleSubmit = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      addRecentSearch(trimmed);
      cancel();
      setOpen(false);
      setActiveIdx(-1);
      inputRef.current?.blur();
      if (onSearch) {
        onSearch(trimmed);
      } else {
        navigate(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [onSearch, navigate, addRecentSearch, cancel],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIdx(-1);
    setOpen(true);
    fetch(val);
  };

  const handleFocus = () => {
    setFocused(true);
    setOpen(true);
    fetch(query);
  };

  const handleBlur = () => {
    // Delay so click events on dropdown items fire first
    setTimeout(() => {
      setFocused(false);
      setOpen(false);
      setActiveIdx(-1);
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'Enter') { e.preventDefault(); handleSubmit(query); }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIdx >= 0 && items[activeIdx]) {
          handleSubmit(items[activeIdx].value);
        } else {
          handleSubmit(query);
        }
        break;
      case 'Escape':
        setOpen(false);
        setActiveIdx(-1);
        inputRef.current?.blur();
        break;
      case 'Tab':
        setOpen(false);
        setActiveIdx(-1);
        break;
    }
  };

  const inputValue = activeIdx >= 0 && items[activeIdx] ? items[activeIdx].value : query;

  const inputProps = {
    ref: inputRef,
    type: 'text' as const,
    value: inputValue,
    onChange: handleInputChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    autoComplete: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    'aria-label': 'Search products',
    'aria-autocomplete': 'list' as const,
    'aria-controls': listboxId,
    'aria-activedescendant': activeIdx >= 0 ? `${listboxId}-item-${activeIdx}` : undefined,
    'aria-expanded': open,
    role: 'combobox' as const,
  };

  const showDropdown = open && focused;

  return (
    <div
      ref={containerRef}
      className={[
        'relative',
        isHero ? 'max-w-xl mx-auto w-full' : 'w-full',
        className,
      ].filter(Boolean).join(' ')}
    >
      {isHero ? (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(query); }} className="relative group">
          <div className={[
            'flex items-center bg-[#221D17] border-2 rounded-2xl h-[56px] sm:h-[60px] px-5 transition-colors duration-200',
            focused ? 'border-[#C9A96E]' : 'border-white/20 group-focus-within:border-[#C9A96E]',
          ].join(' ')}>
            <Search className="w-5 h-5 text-white/40 shrink-0" />
            <input
              {...inputProps}
              placeholder="Search 'kurta set' or paste any product URL..."
              className="flex-1 bg-transparent outline-none text-white placeholder:text-white/35 text-[15px] ml-3 min-h-[44px]"
            />
            <button
              type="submit"
              aria-label="Compare prices"
              className="flex items-center justify-center gap-1.5 bg-[#C9A96E] text-[#171310] font-semibold px-3.5 sm:px-5 py-2.5 rounded-xl text-[13px] hover:bg-[#E8D5A8] transition-colors shrink-0 min-h-[44px] min-w-[44px]"
            >
              <span className="hidden sm:inline">Compare</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      ) : isLg ? (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(query); }} className="relative group w-full">
          <div className={[
            'flex items-center bg-white border-2 rounded-2xl h-[52px] sm:h-[56px] px-5 transition-colors duration-200 shadow-sm',
            focused ? 'border-[#C9A96E]' : 'border-neutral-200 group-focus-within:border-[#C9A96E]',
          ].join(' ')}>
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              {...inputProps}
              placeholder="Search 'kurta set' or paste any product URL..."
              className="flex-1 bg-transparent outline-none text-[#0F0F1A] placeholder:text-neutral-400 text-[15px] ml-3 min-h-[44px]"
            />
            <button
              type="submit"
              aria-label="Compare prices"
              className="flex items-center justify-center gap-1.5 bg-[#0F0F1A] text-white font-semibold px-3.5 sm:px-5 py-2.5 rounded-xl text-[13px] hover:bg-[#C9A96E] transition-colors shrink-0 min-h-[44px] min-w-[44px]"
            >
              <span className="hidden sm:inline">Compare</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      ) : (
        <div className={[
          'relative flex items-center bg-white border transition-all duration-200 h-11 rounded-full px-4 shadow-sm',
          focused ? 'border-[#C9A96E]' : 'border-neutral-200 hover:border-neutral-300',
        ].join(' ')}>
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <form className="flex flex-1 items-center" onSubmit={(e) => { e.preventDefault(); handleSubmit(query); }}>
            <input
              {...inputProps}
              placeholder="Search..."
              className="flex-1 bg-transparent outline-none text-[#0F0F1A] placeholder:text-neutral-400 text-sm ml-2"
            />
            <button type="submit" aria-label="Search" className="shrink-0 flex items-center justify-center rounded-full bg-[#0F0F1A] text-white hover:bg-[#C9A96E] ml-2 w-8 h-8 transition-colors">
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ── Autocomplete Dropdown ── */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.13 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-neutral-100 shadow-[0_8px_32px_rgba(0,0,0,0.10)] z-50 overflow-hidden"
            role="listbox"
            id={listboxId}
            aria-label="Search suggestions"
          >
            <DropdownContent
              query={query}
              data={data}
              status={status}
              recentSearches={recentSearches}
              items={items}
              activeIdx={activeIdx}
              listboxId={listboxId}
              onSelect={handleSubmit}
              onClearRecent={clearRecentSearches}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Dropdown content ─────────────────────────────────────────────────────────

interface DropdownItem {
  type: 'recent' | 'popular' | 'product' | 'brand' | 'category';
  value: string;
  label?: string;
  imageUrl?: string;
  platform?: string;
  price?: number;
  brand?: string;
}

function buildItems(
  query: string,
  data: ReturnType<typeof useAutocomplete>['data'],
  recentSearches: string[],
): DropdownItem[] {
  const items: DropdownItem[] = [];
  const norm = query.trim().toLowerCase();

  // Recent searches (filtered by query if non-empty)
  const filteredRecent = norm
    ? recentSearches.filter(s => s.toLowerCase().includes(norm))
    : recentSearches;
  for (const s of filteredRecent.slice(0, 4)) {
    items.push({ type: 'recent', value: s });
  }

  if (!data) return items;

  // Popular / query suggestions
  for (const p of data.popular.slice(0, 6)) {
    items.push({ type: 'popular', value: p.query });
  }

  // Product suggestions
  for (const p of data.products) {
    items.push({ type: 'product', value: p.title, imageUrl: p.imageUrl, platform: p.platform, price: p.price, brand: p.brand });
  }

  // Brand suggestions
  for (const b of data.brands) {
    items.push({ type: 'brand', value: b, label: b });
  }

  // Category suggestions
  for (const c of data.categories) {
    items.push({ type: 'category', value: c, label: c });
  }

  return items;
}

interface DropdownContentProps {
  query: string;
  data: ReturnType<typeof useAutocomplete>['data'];
  status: ReturnType<typeof useAutocomplete>['status'];
  recentSearches: string[];
  items: DropdownItem[];
  activeIdx: number;
  listboxId: string;
  onSelect: (q: string) => void;
  onClearRecent: () => void;
}

function DropdownContent({
  query,
  data,
  status,
  recentSearches,
  items,
  activeIdx,
  listboxId,
  onSelect,
  onClearRecent,
}: DropdownContentProps) {
  const norm = query.trim().toLowerCase();
  const filteredRecent = norm
    ? recentSearches.filter(s => s.toLowerCase().includes(norm))
    : recentSearches;

  let globalIdx = 0;

  const renderItem = (item: DropdownItem, idx: number) => {
    const isActive = idx === activeIdx;
    const baseClass = [
      'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors duration-100 cursor-pointer',
      isActive ? 'bg-[#C9A96E]/10' : 'hover:bg-neutral-50',
    ].join(' ');

    return (
      <li
        key={`${item.type}-${item.value}-${idx}`}
        id={`${listboxId}-item-${idx}`}
        role="option"
        aria-selected={isActive}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(item.value)}
        className={baseClass}
      >
        {item.type === 'recent' && (
          <>
            <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="text-[13px] text-neutral-700 truncate">{highlight(item.value, query)}</span>
          </>
        )}
        {item.type === 'popular' && (
          <>
            <TrendingUp className="w-3.5 h-3.5 text-[#C9A96E] shrink-0" />
            <span className="text-[13px] text-neutral-700 truncate">{highlight(item.value, query)}</span>
          </>
        )}
        {item.type === 'product' && (
          <>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 bg-neutral-100" loading="lazy" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-neutral-100 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-neutral-800 truncate">{highlight(item.value, query)}</p>
              {(item.brand || item.price) && (
                <p className="text-[11px] text-neutral-400 truncate">
                  {item.brand && <span>{item.brand}</span>}
                  {item.brand && item.price && <span className="mx-1">·</span>}
                  {item.price && <span>{formatPrice(item.price)}</span>}
                  {item.platform && <span className="ml-1 text-neutral-300">on {item.platform}</span>}
                </p>
              )}
            </div>
          </>
        )}
        {item.type === 'brand' && (
          <>
            <Tag className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="text-[13px] text-neutral-700 truncate">
              <span className="text-neutral-400 mr-1">Brand:</span>
              {highlight(item.value, query)}
            </span>
          </>
        )}
        {item.type === 'category' && (
          <>
            <Tag className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="text-[13px] text-neutral-700 truncate">
              <span className="text-neutral-400 mr-1">Category:</span>
              {highlight(item.value, query)}
            </span>
          </>
        )}
      </li>
    );
  };

  // ── Recent searches section ──
  const recentSection = filteredRecent.slice(0, 4);
  const recentItems = items.filter(i => i.type === 'recent');

  // ── Popular section ──
  const popularItems = items.filter(i => i.type === 'popular');

  // ── Product section ──
  const productItems = items.filter(i => i.type === 'product');

  // ── Brand + Category section ──
  const brandItems = items.filter(i => i.type === 'brand');
  const categoryItems = items.filter(i => i.type === 'category');

  const hasContent = items.length > 0;

  if (!hasContent && status === 'loading') {
    return (
      <div className="px-4 py-5 flex items-center gap-2 text-neutral-400 text-[13px]">
        <div className="w-3.5 h-3.5 border-2 border-neutral-200 border-t-[#C9A96E] rounded-full animate-spin" />
        Searching...
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="px-4 py-5 text-neutral-400 text-[13px]">
        No suggestions found
      </div>
    );
  }

  return (
    <ul className="py-2 max-h-[420px] overflow-y-auto overscroll-contain" role="listbox">
      {/* Recent searches */}
      {recentSection.length > 0 && (
        <>
          <li className="flex items-center justify-between px-4 pt-2 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Recent</span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClearRecent}
              className="text-[10px] text-neutral-400 hover:text-neutral-600 flex items-center gap-0.5 transition-colors"
              aria-label="Clear recent searches"
            >
              <X className="w-2.5 h-2.5" /> Clear
            </button>
          </li>
          {recentItems.map((item, i) => renderItem(item, globalIdx++))}
        </>
      )}

      {/* Popular / query suggestions */}
      {popularItems.length > 0 && (
        <>
          <li className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              {query.trim() ? 'Suggestions' : 'Popular searches'}
            </span>
          </li>
          {popularItems.map((item) => renderItem(item, globalIdx++))}
        </>
      )}

      {/* Product suggestions */}
      {productItems.length > 0 && (
        <>
          <li className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Products</span>
          </li>
          {productItems.map((item) => renderItem(item, globalIdx++))}
        </>
      )}

      {/* Brand suggestions */}
      {brandItems.length > 0 && (
        <>
          <li className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Brands</span>
          </li>
          {brandItems.map((item) => renderItem(item, globalIdx++))}
        </>
      )}

      {/* Category suggestions */}
      {categoryItems.length > 0 && (
        <>
          <li className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Categories</span>
          </li>
          {categoryItems.map((item) => renderItem(item, globalIdx++))}
        </>
      )}
    </ul>
  );
}

export default SearchBar;
