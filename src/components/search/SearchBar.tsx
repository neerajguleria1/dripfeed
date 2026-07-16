import { useState, useRef, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const TRENDING_SEARCHES = ['kurta', 'sneakers', 'saree', 'lehenga', 'jeans'];

export interface SearchBarProps {
  size?: 'default' | 'hero';
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
        isHero ? 'max-w-xl mx-auto w-full' : 'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Search Input */}
      <div
        className={[
          'relative flex items-center bg-white border transition-all duration-200',
          isHero
            ? 'h-[56px] rounded-full px-5 shadow-[0_2px_16px_rgba(0,0,0,0.06)]'
            : 'h-11 rounded-full px-4 shadow-sm',
          focused
            ? 'border-[#C9A96E] shadow-[0_0_0_3px_rgba(201,169,110,0.12)]'
            : 'border-neutral-200 hover:border-neutral-300',
        ].filter(Boolean).join(' ')}
      >
        <Search
          className={[
            'text-gray-400 shrink-0',
            isHero ? 'w-5 h-5' : 'w-4 h-4',
          ].join(' ')}
        />
        <form
          className="flex flex-1 items-center"
          onSubmit={(e) => { e.preventDefault(); handleSubmit(query); }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={isHero ? 'Search fashion across 4+ platforms...' : 'Search...'}
            aria-label="Search products"
            className={[
              'flex-1 bg-transparent outline-none placeholder:text-neutral-400 text-[#0F0F1A]',
              isHero ? 'text-[15px] ml-3' : 'text-sm ml-2',
            ].join(' ')}
          />
          <button
            type="submit"
            aria-label="Search"
            onTouchStart={(e) => e.stopPropagation()}
            className={[
              'shrink-0 flex items-center justify-center rounded-full bg-[#0F0F1A] text-white font-semibold transition-colors hover:bg-[#C9A96E] active:bg-[#b8935a]',
              isHero ? 'ml-3 px-5 py-2 text-[13px] h-9' : 'ml-2 w-8 h-8',
            ].join(' ')}
          >
            {isHero ? 'Search' : <Search className="w-3.5 h-3.5" />}
          </button>
        </form>
      </div>

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
