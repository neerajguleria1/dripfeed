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
          'relative flex items-center bg-white/80 backdrop-blur-md border border-white/60 shadow-lg transition-all duration-200',
          isHero ? 'h-14 rounded-2xl px-5' : 'h-10 rounded-xl px-3',
          focused ? 'ring-2 ring-[var(--df-accent-gold)]/30 border-[var(--df-accent-gold)]' : '',
        ]
          .filter(Boolean)
          .join(' ')}
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
            type="search"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Search fashion across 4+ platforms..."
            aria-label="Search products"
            className={[
              'flex-1 bg-transparent outline-none placeholder:text-gray-400 text-[var(--df-accent-navy)]',
              isHero ? 'text-lg ml-3' : 'text-sm ml-2',
            ].join(' ')}
          />
          <button
            type="submit"
            aria-label="Search"
            onTouchStart={(e) => e.stopPropagation()}
            className={[
              'shrink-0 flex items-center justify-center rounded-xl bg-[#C9A96E] text-white font-semibold transition-colors hover:bg-[#b8935a] active:bg-[#a07d4a]',
              isHero ? 'ml-2 px-4 py-2 text-[13px]' : 'ml-1.5 px-3 py-1.5 text-[12px]',
            ].join(' ')}
          >
            {isHero ? 'Search' : '→'}
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
            className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md rounded-xl border border-gray-100 shadow-lg p-3 z-50"
          >
            <p className="text-xs text-gray-500 mb-2 font-medium">Trending searches</p>
            <div className="flex flex-wrap gap-2">
              {TRENDING_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePillClick(term)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-[var(--df-accent-gold-light)] text-[var(--df-accent-navy)] rounded-full transition-colors duration-150 capitalize"
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
