import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Heart, User, X } from 'lucide-react';
import Logo from '../common/Logo';

const TRENDING_TERMS = [
  'Kurta Sets',
  'Nike Sneakers',
  'Sarees under ₹999',
  'Denim Jeans',
  'Ethnic Dresses',
  'Men Shirts',
];

export default function StickyHeader() {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Focus input when search expands
  useEffect(() => {
    if (searchExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchExpanded]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(e.target as Node)
      ) {
        setSearchExpanded(false);
      }
    }
    if (searchExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [searchExpanded]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSearchExpanded(false);
      }
    }
    if (searchExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [searchExpanded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
      setSearchExpanded(false);
      setQuery('');
    }
  };

  const handleSuggestionClick = (term: string) => {
    navigate(`/search?q=${encodeURIComponent(term)}`);
    setSearchExpanded(false);
    setQuery('');
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-neutral-100"
      role="banner"
    >
      {/* Main header bar */}
      <div className="h-14 md:h-16 flex items-center px-3 md:px-6 max-w-7xl mx-auto gap-2">
        {/* Left: Logo */}
        {!searchExpanded && (
          <div className="flex-shrink-0">
            <Logo variant="dark" size="sm" />
          </div>
        )}

        {/* Center: Search input */}
        <div className="flex-1 flex items-center justify-center" ref={overlayRef}>
          {searchExpanded ? (
            <form onSubmit={handleSubmit} className="flex items-center w-full gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products..."
                  aria-label="Search products"
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E] transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => setSearchExpanded(false)}
                aria-label="Close search"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSearchExpanded(true)}
              aria-label="Open search"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 transition-colors text-neutral-500 text-sm flex-1 max-w-xs md:max-w-sm"
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Search products...</span>
            </button>
          )}
        </div>

        {/* Right: Action icons */}
        {!searchExpanded && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/wishlist')}
              aria-label="Wishlist"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
            >
              <Heart className="w-5 h-5 text-neutral-700" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              aria-label="Account"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
            >
              <User className="w-5 h-5 text-neutral-700" />
            </button>
          </div>
        )}
      </div>

      {/* Suggestions overlay */}
      {searchExpanded && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-neutral-100 shadow-lg">
          <div className="max-w-7xl mx-auto px-3 md:px-6 py-4">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
              Trending Searches
            </p>
            <div className="flex flex-wrap gap-2">
              {TRENDING_TERMS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleSuggestionClick(term)}
                  className="min-h-[44px] px-4 py-2 rounded-full border border-neutral-200 bg-neutral-50 hover:bg-[#C9A96E]/10 hover:border-[#C9A96E]/40 text-sm text-neutral-700 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
