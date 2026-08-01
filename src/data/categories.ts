import type { CategoryItem } from '../types/homeFeed';

/**
 * Homepage category chips data.
 * "All" shows the unfiltered feed; other categories map to search queries.
 */
export const HOMEPAGE_CATEGORIES: CategoryItem[] = [
  { id: 'all', label: 'All', query: '' },
  { id: 'trending', label: 'Trending', query: 'trending' },
  { id: 'kurta-sets', label: 'Kurta Sets', query: 'kurta sets' },
  { id: 'sneakers', label: 'Sneakers', query: 'sneakers' },
  { id: 'sarees', label: 'Sarees', query: 'sarees' },
  { id: 'jeans', label: 'Jeans', query: 'jeans' },
  { id: 'dresses', label: 'Dresses', query: 'dresses' },
  { id: 'ethnic-wear', label: 'Ethnic Wear', query: 'ethnic wear' },
];
