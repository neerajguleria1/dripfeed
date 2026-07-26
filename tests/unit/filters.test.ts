/**
 * tests/unit/filters.test.ts
 *
 * Tests for:
 *   - applyFilters, applySort, applyFiltersAndSort (pure functions)
 *   - extractFacets
 *   - filtersToParams / paramsToFilters (URL serialisation round-trip)
 *   - countActiveFilters, isDefaultFilters
 *   - useFilterState hook (URL state management)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

import {
  applyFilters,
  applySort,
  applyFiltersAndSort,
  extractFacets,
  filtersToParams,
  paramsToFilters,
  countActiveFilters,
  isDefaultFilters,
  DEFAULT_FILTERS,
  type FilterState,
  type FilterableProduct,
} from '../../src/types/filters';

import { useFilterState } from '../../src/hooks/useFilterState';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<FilterableProduct> = {}): FilterableProduct {
  return {
    id:            `p_${Math.random().toString(36).slice(2, 6)}`,
    title:         'Test Product',
    brand:         'Nike',
    price:         1500,
    originalPrice: 2000,
    discount:      25,
    rating:        4.2,
    platform:      'Flipkart',
    color:         'Black',
    size:          'M',
    inStock:       true,
    fetchedAt:     Date.now(),
    ...overrides,
  };
}

const defaultFilters: FilterState = { ...DEFAULT_FILTERS };

// ─── applyFilters ─────────────────────────────────────────────────────────────

describe('applyFilters', () => {
  it('returns all products when no filters active', () => {
    const products = [makeProduct(), makeProduct()];
    expect(applyFilters(products, defaultFilters)).toHaveLength(2);
  });

  it('filters by platform (case-insensitive)', () => {
    const products = [
      makeProduct({ platform: 'Flipkart' }),
      makeProduct({ platform: 'Myntra' }),
    ];
    const result = applyFilters(products, { ...defaultFilters, platforms: ['flipkart'] });
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe('Flipkart');
  });

  it('filters by multiple platforms (OR logic)', () => {
    const products = [
      makeProduct({ platform: 'Flipkart' }),
      makeProduct({ platform: 'Myntra' }),
      makeProduct({ platform: 'Ajio' }),
    ];
    const result = applyFilters(products, { ...defaultFilters, platforms: ['Flipkart', 'Myntra'] });
    expect(result).toHaveLength(2);
  });

  it('filters by brand (case-insensitive)', () => {
    const products = [makeProduct({ brand: 'Nike' }), makeProduct({ brand: 'Adidas' })];
    const result = applyFilters(products, { ...defaultFilters, brands: ['nike'] });
    expect(result).toHaveLength(1);
  });

  it('filters by color', () => {
    const products = [makeProduct({ color: 'Black' }), makeProduct({ color: 'White' })];
    const result = applyFilters(products, { ...defaultFilters, colors: ['Black'] });
    expect(result).toHaveLength(1);
  });

  it('filters by size', () => {
    const products = [makeProduct({ size: 'M' }), makeProduct({ size: 'XL' })];
    const result = applyFilters(products, { ...defaultFilters, sizes: ['M'] });
    expect(result).toHaveLength(1);
  });

  it('filters by price preset under500', () => {
    const products = [makeProduct({ price: 300 }), makeProduct({ price: 800 })];
    const result = applyFilters(products, { ...defaultFilters, pricePreset: 'under500' });
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(300);
  });

  it('filters by price preset 500-1000', () => {
    const products = [makeProduct({ price: 300 }), makeProduct({ price: 750 }), makeProduct({ price: 1200 })];
    const result = applyFilters(products, { ...defaultFilters, pricePreset: '500-1000' });
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(750);
  });

  it('filters by custom price range (priceMin/priceMax)', () => {
    const products = [makeProduct({ price: 500 }), makeProduct({ price: 1500 }), makeProduct({ price: 3000 })];
    const result = applyFilters(products, { ...defaultFilters, priceMin: 1000, priceMax: 2000 });
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(1500);
  });

  it('custom price range takes precedence over preset', () => {
    const products = [makeProduct({ price: 300 }), makeProduct({ price: 1500 })];
    // pricePreset says under500 but custom range says 1000-2000
    const result = applyFilters(products, { ...defaultFilters, pricePreset: 'under500', priceMin: 1000, priceMax: 2000 });
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(1500);
  });

  it('filters by minDiscount', () => {
    const products = [makeProduct({ discount: 10 }), makeProduct({ discount: 40 })];
    const result = applyFilters(products, { ...defaultFilters, minDiscount: 30 });
    expect(result).toHaveLength(1);
    expect(result[0].discount).toBe(40);
  });

  it('filters by minRating', () => {
    const products = [makeProduct({ rating: 3.2 }), makeProduct({ rating: 4.5 })];
    const result = applyFilters(products, { ...defaultFilters, minRating: 4 });
    expect(result).toHaveLength(1);
    expect(result[0].rating).toBe(4.5);
  });

  it('filters out-of-stock when inStockOnly is true', () => {
    const products = [makeProduct({ inStock: true }), makeProduct({ inStock: false })];
    const result = applyFilters(products, { ...defaultFilters, inStockOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].inStock).toBe(true);
  });

  it('does NOT filter products with undefined inStock when inStockOnly is true', () => {
    // undefined inStock means we don't know — don't exclude
    const products = [makeProduct({ inStock: undefined }), makeProduct({ inStock: false })];
    const result = applyFilters(products, { ...defaultFilters, inStockOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].inStock).toBeUndefined();
  });

  it('combines multiple filters (AND logic)', () => {
    const products = [
      makeProduct({ platform: 'Flipkart', discount: 40, price: 800 }),
      makeProduct({ platform: 'Myntra',   discount: 40, price: 800 }),
      makeProduct({ platform: 'Flipkart', discount: 5,  price: 800 }),
    ];
    const result = applyFilters(products, { ...defaultFilters, platforms: ['Flipkart'], minDiscount: 30 });
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe('Flipkart');
    expect(result[0].discount).toBe(40);
  });

  it('returns empty array when no products match', () => {
    const products = [makeProduct({ platform: 'Flipkart' })];
    const result = applyFilters(products, { ...defaultFilters, platforms: ['Myntra'] });
    expect(result).toHaveLength(0);
  });
});

// ─── applySort ────────────────────────────────────────────────────────────────

describe('applySort', () => {
  it('price-asc sorts ascending', () => {
    const products = [makeProduct({ price: 3000 }), makeProduct({ price: 500 }), makeProduct({ price: 1500 })];
    const result = applySort(products, 'price-asc');
    expect(result.map(p => p.price)).toEqual([500, 1500, 3000]);
  });

  it('price-desc sorts descending', () => {
    const products = [makeProduct({ price: 500 }), makeProduct({ price: 3000 }), makeProduct({ price: 1500 })];
    const result = applySort(products, 'price-desc');
    expect(result.map(p => p.price)).toEqual([3000, 1500, 500]);
  });

  it('discount-desc sorts by discount descending', () => {
    const products = [makeProduct({ discount: 10 }), makeProduct({ discount: 50 }), makeProduct({ discount: 30 })];
    const result = applySort(products, 'discount-desc');
    expect(result.map(p => p.discount)).toEqual([50, 30, 10]);
  });

  it('newest sorts by fetchedAt descending', () => {
    const now = Date.now();
    const products = [
      makeProduct({ fetchedAt: now - 3000 }),
      makeProduct({ fetchedAt: now }),
      makeProduct({ fetchedAt: now - 1000 }),
    ];
    const result = applySort(products, 'newest');
    expect(result[0].fetchedAt).toBe(now);
  });

  it('price-history-low sorts by priceHistoryLow ascending, unknowns last', () => {
    const products = [
      makeProduct({ priceHistoryLow: 2000 }),
      makeProduct({ priceHistoryLow: undefined }),
      makeProduct({ priceHistoryLow: 800 }),
    ];
    const result = applySort(products, 'price-history-low');
    expect(result[0].priceHistoryLow).toBe(800);
    expect(result[1].priceHistoryLow).toBe(2000);
    expect(result[2].priceHistoryLow).toBeUndefined();
  });

  it('best-value ranks high discount + high rating first', () => {
    const products = [
      makeProduct({ discount: 5,  rating: 3.0 }),
      makeProduct({ discount: 60, rating: 4.8 }),
      makeProduct({ discount: 30, rating: 4.0 }),
    ];
    const result = applySort(products, 'best-value');
    expect(result[0].discount).toBe(60);
  });

  it('relevance and popularity preserve original order', () => {
    const products = [makeProduct({ id: 'a' }), makeProduct({ id: 'b' }), makeProduct({ id: 'c' })];
    expect(applySort(products, 'relevance').map(p => p.id)).toEqual(['a', 'b', 'c']);
    expect(applySort(products, 'popularity').map(p => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the original array', () => {
    const products = [makeProduct({ price: 3000 }), makeProduct({ price: 500 })];
    const original = [...products];
    applySort(products, 'price-asc');
    expect(products[0].price).toBe(original[0].price);
  });
});

// ─── extractFacets ────────────────────────────────────────────────────────────

describe('extractFacets', () => {
  it('extracts unique platforms', () => {
    const products = [makeProduct({ platform: 'Flipkart' }), makeProduct({ platform: 'Myntra' }), makeProduct({ platform: 'Flipkart' })];
    const facets = extractFacets(products);
    expect(facets.platforms).toEqual(['Flipkart', 'Myntra']);
  });

  it('extracts unique brands', () => {
    const products = [makeProduct({ brand: 'Nike' }), makeProduct({ brand: 'Adidas' }), makeProduct({ brand: 'Nike' })];
    const facets = extractFacets(products);
    expect(facets.brands).toEqual(['Adidas', 'Nike']);
  });

  it('extracts unique colors', () => {
    const products = [makeProduct({ color: 'Black' }), makeProduct({ color: 'White' })];
    const facets = extractFacets(products);
    expect(facets.colors).toContain('Black');
    expect(facets.colors).toContain('White');
  });

  it('splits slash-separated sizes', () => {
    const products = [makeProduct({ size: 'S/M/L' })];
    const facets = extractFacets(products);
    expect(facets.sizes).toContain('S');
    expect(facets.sizes).toContain('M');
    expect(facets.sizes).toContain('L');
  });

  it('computes min and max price', () => {
    const products = [makeProduct({ price: 500 }), makeProduct({ price: 3000 }), makeProduct({ price: 1200 })];
    const facets = extractFacets(products);
    expect(facets.minPrice).toBe(500);
    expect(facets.maxPrice).toBe(3000);
  });

  it('returns empty facets for empty product list', () => {
    const facets = extractFacets([]);
    expect(facets.platforms).toEqual([]);
    expect(facets.brands).toEqual([]);
    expect(facets.minPrice).toBe(0);
    expect(facets.maxPrice).toBe(0);
  });

  it('ignores undefined brand/color/size', () => {
    const products = [makeProduct({ brand: undefined, color: undefined, size: undefined })];
    const facets = extractFacets(products);
    expect(facets.brands).toEqual([]);
    expect(facets.colors).toEqual([]);
    expect(facets.sizes).toEqual([]);
  });
});

// ─── URL serialisation ────────────────────────────────────────────────────────

describe('filtersToParams / paramsToFilters', () => {
  it('round-trips default filters to empty params', () => {
    const params = filtersToParams(DEFAULT_FILTERS);
    expect(Object.keys(params)).toHaveLength(0);
  });

  it('round-trips platforms', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, platforms: ['Flipkart', 'Myntra'] };
    const params = new URLSearchParams(filtersToParams(f));
    const restored = paramsToFilters(params);
    expect(restored.platforms).toEqual(['Flipkart', 'Myntra']);
  });

  it('round-trips brands', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, brands: ['Nike', 'Adidas'] };
    const params = new URLSearchParams(filtersToParams(f));
    expect(paramsToFilters(params).brands).toEqual(['Nike', 'Adidas']);
  });

  it('round-trips pricePreset', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, pricePreset: '1000-2000' };
    const params = new URLSearchParams(filtersToParams(f));
    expect(paramsToFilters(params).pricePreset).toBe('1000-2000');
  });

  it('round-trips custom price range', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, priceMin: 500, priceMax: 2000 };
    const params = new URLSearchParams(filtersToParams(f));
    const restored = paramsToFilters(params);
    expect(restored.priceMin).toBe(500);
    expect(restored.priceMax).toBe(2000);
  });

  it('round-trips minDiscount', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, minDiscount: 30 };
    const params = new URLSearchParams(filtersToParams(f));
    expect(paramsToFilters(params).minDiscount).toBe(30);
  });

  it('round-trips minRating', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, minRating: 4 };
    const params = new URLSearchParams(filtersToParams(f));
    expect(paramsToFilters(params).minRating).toBe(4);
  });

  it('round-trips inStockOnly', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, inStockOnly: true };
    const params = new URLSearchParams(filtersToParams(f));
    expect(paramsToFilters(params).inStockOnly).toBe(true);
  });

  it('round-trips sort', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, sort: 'discount-desc' };
    const params = new URLSearchParams(filtersToParams(f));
    expect(paramsToFilters(params).sort).toBe('discount-desc');
  });

  it('falls back to relevance for invalid sort value', () => {
    const params = new URLSearchParams({ sort: 'invalid-sort' });
    expect(paramsToFilters(params).sort).toBe('relevance');
  });

  it('round-trips colors and sizes', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, colors: ['Black', 'White'], sizes: ['S', 'M'] };
    const params = new URLSearchParams(filtersToParams(f));
    const restored = paramsToFilters(params);
    expect(restored.colors).toEqual(['Black', 'White']);
    expect(restored.sizes).toEqual(['S', 'M']);
  });
});

// ─── countActiveFilters / isDefaultFilters ────────────────────────────────────

describe('countActiveFilters', () => {
  it('returns 0 for default filters', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });

  it('counts each platform as 1', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, platforms: ['Flipkart', 'Myntra'] })).toBe(2);
  });

  it('counts pricePreset as 1', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, pricePreset: 'under500' })).toBe(1);
  });

  it('counts custom price range as 1', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, priceMin: 500, priceMax: 2000 })).toBe(1);
  });

  it('counts minDiscount, minRating, inStockOnly each as 1', () => {
    const f: FilterState = { ...DEFAULT_FILTERS, minDiscount: 20, minRating: 4, inStockOnly: true };
    expect(countActiveFilters(f)).toBe(3);
  });
});

describe('isDefaultFilters', () => {
  it('returns true for DEFAULT_FILTERS', () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
  });

  it('returns false when any filter is set', () => {
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, platforms: ['Flipkart'] })).toBe(false);
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, sort: 'price-asc' })).toBe(false);
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, inStockOnly: true })).toBe(false);
  });
});

// ─── useFilterState ───────────────────────────────────────────────────────────

function wrapper({ initialEntries = ['/search'] }: { initialEntries?: string[] } = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(MemoryRouter, { initialEntries }, children);
  };
}

describe('useFilterState', () => {
  it('returns default filters when URL has no filter params', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper({ initialEntries: ['/search?q=kurta'] }),
    });
    expect(result.current.query).toBe('kurta');
    expect(result.current.filters).toMatchObject(DEFAULT_FILTERS);
  });

  it('parses filters from URL on init', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper({ initialEntries: ['/search?q=kurta&platforms=Flipkart&minDiscount=20'] }),
    });
    expect(result.current.filters.platforms).toEqual(['Flipkart']);
    expect(result.current.filters.minDiscount).toBe(20);
  });

  it('setFilters updates URL params', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper({ initialEntries: ['/search?q=kurta'] }),
    });
    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, platforms: ['Myntra'] });
    });
    expect(result.current.filters.platforms).toEqual(['Myntra']);
  });

  it('setSort updates only sort in URL', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper({ initialEntries: ['/search?q=kurta&platforms=Flipkart'] }),
    });
    act(() => {
      result.current.setSort('price-asc');
    });
    expect(result.current.filters.sort).toBe('price-asc');
    expect(result.current.filters.platforms).toEqual(['Flipkart']); // preserved
  });

  it('resetFilters clears all filter params but keeps query', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper({ initialEntries: ['/search?q=kurta&platforms=Flipkart&minDiscount=20'] }),
    });
    act(() => {
      result.current.resetFilters();
    });
    expect(result.current.query).toBe('kurta');
    expect(result.current.filters.platforms).toEqual([]);
    expect(result.current.filters.minDiscount).toBe(0);
  });

  it('setQuery updates q param and clears filters', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper({ initialEntries: ['/search?q=kurta&platforms=Flipkart'] }),
    });
    act(() => {
      result.current.setQuery('saree');
    });
    expect(result.current.query).toBe('saree');
    expect(result.current.filters.platforms).toEqual([]);
  });

  it('setQuery preserves sort when changing query', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper({ initialEntries: ['/search?q=kurta&sort=price-asc'] }),
    });
    act(() => {
      result.current.setQuery('saree');
    });
    expect(result.current.filters.sort).toBe('price-asc');
  });

  it('setQuery ignores empty string', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper({ initialEntries: ['/search?q=kurta'] }),
    });
    act(() => {
      result.current.setQuery('   ');
    });
    expect(result.current.query).toBe('kurta'); // unchanged
  });
});
