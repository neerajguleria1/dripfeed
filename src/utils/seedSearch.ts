import { ALL_SEED_PRODUCTS } from '../../api/_lib/seed-data';
import type { ProductData } from '../types/product';

function normalize(s: string) {
  return s.toLowerCase().replace(/[-_]/g, ' ');
}

/** Search ALL_SEED_PRODUCTS by query (title/brand/category) and expand all platforms */
export function searchSeedProducts(query: string): ProductData[] {
  const q = normalize(query.trim());
  if (!q) return [];

  const terms = q.split(' ').filter(t => t.length > 1);

  const scored = ALL_SEED_PRODUCTS
    .map(sp => {
      const haystack = normalize(`${sp.title} ${sp.brand} ${sp.category}`);
      const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      return { sp, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.flatMap(({ sp }) =>
    sp.platforms.map((p, i) => ({
      id: `seed_${sp.title}_${p.platform}_${i}`,
      title: sp.title,
      brand: sp.brand,
      imageUrl: sp.imageUrl,
      price: p.price,
      originalPrice: p.originalPrice,
      discount: Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100),
      platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      url: p.url,
    }))
  ).sort((a, b) => a.price - b.price);
}

/** Get all products for a category slug */
export function getSeedByCategory(slug: string): ProductData[] {
  return ALL_SEED_PRODUCTS
    .filter(sp => sp.category === slug)
    .flatMap((sp, si) =>
      sp.platforms.map((p, i) => ({
        id: `seed_${si}_${i}`,
        title: sp.title,
        brand: sp.brand,
        imageUrl: sp.imageUrl,
        price: p.price,
        originalPrice: p.originalPrice,
        discount: Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100),
        platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
        url: p.url,
      }))
    ).sort((a, b) => a.price - b.price);
}
