import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { name: 'Ethnic Wear', emoji: '🪔', slug: 'ethnic-wear' },
  { name: 'Western', emoji: '👗', slug: 'western' },
  { name: 'Footwear', emoji: '👟', slug: 'footwear' },
  { name: 'Accessories', emoji: '💍', slug: 'accessories' },
  { name: 'Fusion Wear', emoji: '✨', slug: 'fusion-wear' },
  { name: 'Activewear', emoji: '🏃', slug: 'activewear' },
];

export function CategoryTiles() {
  const navigate = useNavigate();

  return (
    <section className="px-6 sm:px-8 lg:px-16 py-16">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-[20px] sm:text-[24px] font-bold text-neutral-900 tracking-[-0.01em] mb-8">
          Shop by Category
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => navigate(`/category/${cat.slug}`)}
              className="bg-neutral-50 rounded-2xl p-7 text-center hover:bg-neutral-100 transition-colors duration-150 group"
            >
              <span className="text-3xl block mb-3 group-hover:scale-110 transition-transform duration-150">{cat.emoji}</span>
              <span className="text-[13px] font-semibold text-neutral-700 tracking-wide">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CategoryTiles;
