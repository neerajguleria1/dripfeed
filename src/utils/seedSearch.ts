import { ALL_SEED_PRODUCTS, type SeedProduct } from '../../api/_lib/seed-data';
import type { ProductData } from '../types/product';

function normalize(s: string) {
  return s.toLowerCase().replace(/[-_]/g, ' ');
}

/**
 * Convert a seed product to ProductData using its cheapest platform.
 * One card per product — no image/data bleed across platform rows.
 */
function seedToProductData(sp: SeedProduct, idx: number): ProductData {
  const cheapest = sp.platforms.reduce((a, b) => (a.price < b.price ? a : b));
  return {
    id: `seed_${idx}_${cheapest.platform}`,
    title: sp.title,
    brand: sp.brand,
    imageUrl: sp.imageUrl,
    price: cheapest.price,
    originalPrice: cheapest.originalPrice,
    discount: Math.round(((cheapest.originalPrice - cheapest.price) / cheapest.originalPrice) * 100),
    platform: cheapest.platform.charAt(0).toUpperCase() + cheapest.platform.slice(1),
    url: cheapest.url,
  };
}

/** Search ALL_SEED_PRODUCTS by query (title/brand/category), one card per product */
export function searchSeedProducts(query: string): ProductData[] {
  const q = normalize(query.trim());
  if (!q) return [];

  const terms = q.split(' ').filter(t => t.length > 1);

  return ALL_SEED_PRODUCTS
    .map((sp, idx) => {
      const haystack = normalize(`${sp.title} ${sp.brand} ${sp.category}`);
      const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      return { sp, idx, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.sp.platforms[0].price - b.sp.platforms[0].price)
    .map(({ sp, idx }) => seedToProductData(sp, idx));
}

/** Get all products for a category slug, one card per product sorted by price */
export function getSeedByCategory(slug: string): ProductData[] {
  return ALL_SEED_PRODUCTS
    .filter(sp => sp.category === slug)
    .map((sp, idx) => seedToProductData(sp, idx))
    .sort((a, b) => a.price - b.price);
}
