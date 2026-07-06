import { useNavigate } from 'react-router-dom';

export interface EmptyStateProps {
  query?: string;
}

const CATEGORIES = [
  { name: 'Ethnic Wear', emoji: '🪔', slug: 'ethnic-wear', gradient: 'from-orange-100 to-amber-50' },
  { name: 'Western', emoji: '👗', slug: 'western', gradient: 'from-blue-100 to-sky-50' },
  { name: 'Footwear', emoji: '👟', slug: 'footwear', gradient: 'from-green-100 to-emerald-50' },
  { name: 'Accessories', emoji: '💍', slug: 'accessories', gradient: 'from-purple-100 to-violet-50' },
  { name: 'Fusion Wear', emoji: '✨', slug: 'fusion-wear', gradient: 'from-pink-100 to-rose-50' },
  { name: 'Activewear', emoji: '🏃', slug: 'activewear', gradient: 'from-teal-100 to-cyan-50' },
];

const TRENDING_SEARCHES = ['kurta', 'sneakers', 'saree', 'lehenga', 'jeans', 'hoodie', 'dress', 'palazzo'];

export function EmptyState({ query }: EmptyStateProps) {
  const navigate = useNavigate();

  function handleCategoryClick(slug: string) {
    navigate(`/search?q=${encodeURIComponent(slug.replace('-', ' '))}`);
  }

  function handleTrendingClick(term: string) {
    navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="flex flex-col items-center py-12 px-4">
      {/* Illustration */}
      <div className="text-6xl mb-4">🔍</div>

      {/* Message */}
      {query ? (
        <h3 className="text-lg font-semibold text-[var(--df-accent-navy)] text-center mb-1">
          No results found for &ldquo;{query}&rdquo;
        </h3>
      ) : (
        <h3 className="text-lg font-semibold text-[var(--df-accent-navy)] text-center mb-1">
          Start searching
        </h3>
      )}
      <p className="text-sm text-gray-500 text-center mb-8">
        Try a different search or browse categories
      </p>

      {/* Trending searches as pills */}
      <div className="w-full max-w-md mb-8">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3 text-center">
          Trending searches
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {TRENDING_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => handleTrendingClick(term)}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-[var(--df-accent-gold-light)] text-[var(--df-accent-navy)] rounded-full transition-colors duration-150 capitalize"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* Category tiles grid */}
      <div className="w-full max-w-lg">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3 text-center">
          Browse categories
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => handleCategoryClick(cat.slug)}
              className={`bg-gradient-to-br ${cat.gradient} rounded-xl p-4 text-center hover:shadow-md transition-shadow duration-200`}
            >
              <span className="text-2xl block mb-1">{cat.emoji}</span>
              <span className="text-xs font-semibold text-[var(--df-accent-navy)]">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default EmptyState;
