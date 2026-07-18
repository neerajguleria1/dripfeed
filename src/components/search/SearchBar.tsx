import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const TRENDING_SEARCHES = ['kurta', 'sneakers', 'saree', 'lehenga', 'jeans'];

export interface SearchBarProps {
  size?: 'default' | 'hero' | 'lg';
  initialQuery?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export function SearchBar({
  size = 'default',
  initialQuery = '',
  onSearch,
  className = '',
}: SearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Sync input value when the URL query changes (e.g. user searches from another page)
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHero = size === 'hero';
  const isLg = size === 'lg';

  const handleSubmit = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      if (onSearch) {
        onSearch(trimmed);
      } else {
        navigate(`/search?q=${encodeURIComponent(trimmed)}`);
      }
      setShowDropdown(false);
      inputRef.current?.blur();
    },
    [onSearch, navigate],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(query);
    }
  };

  const handlePillClick = (term: string) => {
    setQuery(term);
    handleSubmit(term);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setShowDropdown(true);
    }, 300);
  };

  const handleFocus = () => {
    setFocused(true);
    setShowDropdown(true);
  };

  const handleBlur = () => {
    // 300ms delay — gives mobile tap events (touchstart → touchend → click)
    // enough time to fire before the dropdown/button disappears
    setTimeout(() => {
      setFocused(false);
      setShowDropdown(false);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={[
        'relative',
        isHero ? 'max-w-xl mx-auto w-full' : isLg ? 'w-full' : 'w-full',
        className,
      ].filter(Boolean).join(' ')}
    >
      {isHero ? (
        /* ── Hero: exact homepage style ── */
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(query); }} className="relative group">
          <div className={[
            'flex items-center bg-[#221D17] border-2 rounded-2xl h-[56px] sm:h-[60px] px-5 transition-colors duration-200',
            focused ? 'border-[#C9A96E]' : 'border-white/20 group-focus-within:border-[#C9A96E]',
          ].join(' ')}>
            <Search className="w-5 h-5 text-white/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Search 'kurta set' or paste any product URL..."
              aria-label="Search products"
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
        /* ── Lg: full-width white bar with Compare button ── */
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(query); }} className="relative group w-full">
          <div className={[
            'flex items-center bg-white border-2 rounded-2xl h-[52px] sm:h-[56px] px-5 transition-colors duration-200 shadow-sm',
            focused ? 'border-[#C9A96E]' : 'border-neutral-200 group-focus-within:border-[#C9A96E]',
          ].join(' ')}>
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Search 'kurta set' or paste any product URL..."
              aria-label="Search products"
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
        /* ── Default: small white pill ── */
        <div className={[
          'relative flex items-center bg-white border transition-all duration-200 h-11 rounded-full px-4 shadow-sm',
          focused ? 'border-[#C9A96E]' : 'border-neutral-200 hover:border-neutral-300',
        ].join(' ')}>
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <form className="flex flex-1 items-center" onSubmit={(e) => { e.preventDefault(); handleSubmit(query); }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
              aria-label="Search products"
              className="flex-1 bg-transparent outline-none text-[#0F0F1A] placeholder:text-neutral-400 text-sm ml-2"
            />
            <button type="submit" aria-label="Search" className="shrink-0 flex items-center justify-center rounded-full bg-[#0F0F1A] text-white hover:bg-[#C9A96E] ml-2 w-8 h-8 transition-colors">
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Trending Dropdown */}
      <AnimatePresence>
        {showDropdown && focused && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-neutral-100 shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-4 z-50"
          >
            <p className="text-[11px] text-neutral-400 mb-3 font-semibold uppercase tracking-[0.08em]">Trending searches</p>
            <div className="flex flex-wrap gap-2">
              {TRENDING_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePillClick(term)}
                  className="px-4 py-1.5 text-[13px] bg-neutral-50 hover:bg-[#C9A96E]/10 hover:text-[#8B7340] border border-neutral-100 hover:border-[#C9A96E]/30 text-neutral-600 rounded-full transition-all duration-150 capitalize font-medium"
                >
                  {term}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SearchBar;
