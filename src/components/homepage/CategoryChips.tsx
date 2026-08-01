import { HOMEPAGE_CATEGORIES } from '../../data/categories';
import type { CategoryItem } from '../../types/homeFeed';

interface CategoryChipsProps {
  /** The id of the currently active category */
  activeCategory: string;
  /** Callback fired when a category chip is selected */
  onSelect: (categoryId: string) => void;
}

/**
 * Horizontal scrollable row of pill-shaped category filter chips.
 * Active chip uses the brand gold (#C9A96E); inactive chips use a neutral border style.
 * Minimum 44px height per chip for accessible touch targets.
 */
export default function CategoryChips({ activeCategory, onSelect }: CategoryChipsProps) {
  return (
    <nav
      aria-label="Category filters"
      className="overflow-x-auto flex gap-2 px-4 py-2 scrollbar-hide"
      style={{ WebkitOverflowScrolling: 'touch', flexWrap: 'nowrap' }}
    >
      {HOMEPAGE_CATEGORIES.map((cat: CategoryItem) => {
        const isActive = cat.id === activeCategory;

        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(cat.id)}
            className={`
              flex-shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium
              transition-colors duration-150 whitespace-nowrap select-none
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A96E]
              ${
                isActive
                  ? 'bg-[#C9A96E] text-[#1A1A1A] border border-[#C9A96E]'
                  : 'bg-transparent text-neutral-600 border border-neutral-300 hover:border-neutral-400 hover:text-neutral-800'
              }
            `}
          >
            {cat.label}
          </button>
        );
      })}
    </nav>
  );
}
