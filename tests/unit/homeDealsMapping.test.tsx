/**
 * Unit tests for the "Today's biggest drops" mapping helpers and render states.
 * Validates: Requirements 2.1, 2.2, 2.3
 *
 * Structure:
 *  - Describe block 1: pure-function unit tests for `mapDealApiToDealData` and
 *    `mapTrendingApiToDealData` — no DOM required.
 *  - Describe block 2: component-level render-state assertions (loading skeleton
 *    count, deals-empty+trending-nonempty, both-empty/both-error) — these need a
 *    DOM environment, so this file opts into jsdom via the docblock below,
 *    reusing the same mounting pattern as
 *    `tests/integration/homePageDeals.exploration.test.tsx`.
 *  - Describe block 3: a static/lint-level grep check that `ALL_SEED_PRODUCTS`
 *    no longer appears anywhere in `HomePage.tsx`'s source.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import api from '../../src/services/api';
import { AuthProvider } from '../../src/context/AuthContext';
import HomePage from '../../src/pages/HomePage';
import {
  mapDealApiToDealData,
  mapTrendingApiToDealData,
  type DealApiItem,
  type TrendingApiItem,
} from '../../src/utils/homeDealsMapping';

vi.mock('../../src/services/api');

const mockedApiGet = api.get as unknown as ReturnType<typeof vi.fn>;

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_PAGE_PATH = resolve(__dirname, '../../src/pages/HomePage.tsx');

// jsdom does not implement IntersectionObserver, which framer-motion's
// `useInView` (used by the homepage's `Reveal` wrapper) relies on. Provide a
// minimal stub so components mount without crashing.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
// @ts-expect-error - jsdom lacks this global; test-only stub.
global.IntersectionObserver = MockIntersectionObserver;

function renderHomePage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function getDealsSection(): HTMLElement {
  const heading = screen.getByText("Today's biggest drops");
  const section = heading.closest('section');
  if (!section) throw new Error('Could not find "Today\'s biggest drops" section');
  return section as HTMLElement;
}

// ─── Pure Mapping Function Unit Tests ────────────────────────────────────────

describe('mapDealApiToDealData', () => {
  it('renames productTitle->title, currentPrice->price, previousPrice->originalPrice, dropPercentage->discount, and passes through id/brand/imageUrl/platform/url', () => {
    const input: DealApiItem = {
      id: 'deal-1',
      productTitle: 'Floral Kurta Set',
      brand: 'Libas',
      imageUrl: 'https://example.com/img.jpg',
      platform: 'myntra',
      currentPrice: 799,
      previousPrice: 1599,
      dropPercentage: 50,
      url: 'https://example.com/product/1',
      detectedAt: '2024-01-01T00:00:00.000Z',
      trackersCount: 3,
    };

    const result = mapDealApiToDealData(input);

    expect(result).toEqual({
      id: 'deal-1',
      title: 'Floral Kurta Set',
      brand: 'Libas',
      imageUrl: 'https://example.com/img.jpg',
      price: 799,
      originalPrice: 1599,
      discount: 50,
      platform: 'myntra',
      url: 'https://example.com/product/1',
    });
  });

  it('passes through undefined brand/imageUrl/previousPrice without inventing defaults', () => {
    const input: DealApiItem = {
      id: 'deal-2',
      productTitle: 'Plain Tee',
      platform: 'ajio',
      currentPrice: 399,
      dropPercentage: 0,
      url: 'https://example.com/product/2',
    };

    const result = mapDealApiToDealData(input);

    expect(result.title).toBe('Plain Tee');
    expect(result.price).toBe(399);
    expect(result.discount).toBe(0);
    expect(result.brand).toBeUndefined();
    expect(result.imageUrl).toBeUndefined();
    expect(result.originalPrice).toBeUndefined();
  });
});

describe('mapTrendingApiToDealData', () => {
  it('passes through title/price/originalPrice/discount/platform/url/brand/imageUrl/id unchanged', () => {
    const input: TrendingApiItem = {
      id: 'trend-1',
      title: 'Denim Jacket',
      brand: 'Levis',
      imageUrl: 'https://example.com/jacket.jpg',
      price: 1999,
      originalPrice: 2999,
      discount: 33,
      platform: 'amazon',
      url: 'https://example.com/product/jacket',
    };

    const result = mapTrendingApiToDealData(input);

    expect(result).toEqual({
      id: 'trend-1',
      title: 'Denim Jacket',
      brand: 'Levis',
      imageUrl: 'https://example.com/jacket.jpg',
      price: 1999,
      originalPrice: 2999,
      discount: 33,
      platform: 'amazon',
      url: 'https://example.com/product/jacket',
    });
  });

  it('defaults discount to 0 when undefined', () => {
    const input: TrendingApiItem = {
      id: 'trend-2',
      title: 'Sneakers',
      price: 2499,
      platform: 'flipkart',
      url: 'https://example.com/product/sneakers',
      // discount intentionally omitted
    };

    const result = mapTrendingApiToDealData(input);

    expect(result.discount).toBe(0);
    expect(result.title).toBe('Sneakers');
    expect(result.price).toBe(2499);
    expect(result.platform).toBe('flipkart');
    expect(result.url).toBe('https://example.com/product/sneakers');
  });
});

// ─── Render-State Unit Tests (component-level, requires jsdom) ──────────────

describe('HomePage deals section render states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders exactly 8 HomeDealCardSkeleton placeholders while both fetches are pending', async () => {
    // Never-resolving promise keeps the component in the 'loading' state.
    mockedApiGet.mockReturnValue(new Promise(() => {}));

    renderHomePage();

    const section = getDealsSection();
    const skeletons = section.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(8);
  });

  it('renders trending-derived cards (not seed data, not the empty-state message) when deals is empty and trending is non-empty', async () => {
    mockedApiGet.mockImplementation((url: string) => {
      if (url === '/products/deals') {
        return Promise.resolve({ data: { deals: [], total: 0 } });
      }
      if (url === '/products/trending') {
        return Promise.resolve({
          data: {
            products: [
              {
                id: 't1',
                title: 'UNIT-TEST-TRENDING-ITEM',
                brand: 'B',
                imageUrl: 'https://example.com/i.jpg',
                price: 500,
                originalPrice: 1000,
                discount: 50,
                platform: 'myntra',
                url: 'https://example.com/p',
              },
            ],
            total: 1,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderHomePage();

    await expect(screen.findByText('UNIT-TEST-TRENDING-ITEM')).resolves.toBeInTheDocument();
    expect(screen.queryByText(/No new deals right now/i)).not.toBeInTheDocument();

    const section = getDealsSection();
    expect(section.querySelectorAll('.animate-pulse').length).toBe(0);
  });

  it('renders the empty-state message and zero deal cards when both deals and trending are empty', async () => {
    mockedApiGet.mockImplementation((url: string) => {
      if (url === '/products/deals') {
        return Promise.resolve({ data: { deals: [], total: 0 } });
      }
      if (url === '/products/trending') {
        return Promise.resolve({ data: { products: [], total: 0 } });
      }
      return Promise.resolve({ data: {} });
    });

    renderHomePage();

    await screen.findByText(/No new deals right now — check back soon/i);

    const section = getDealsSection();
    expect(section.querySelectorAll('.animate-pulse').length).toBe(0);
    // No deal card <h3> titles should be rendered in the section.
    expect(section.querySelectorAll('h3').length).toBe(0);
  });

  it('renders the empty-state message and zero deal cards when both deals and trending requests error', async () => {
    mockedApiGet.mockImplementation(() => Promise.reject(new Error('network error')));

    renderHomePage();

    await screen.findByText(/No new deals right now — check back soon/i);

    const section = getDealsSection();
    expect(section.querySelectorAll('.animate-pulse').length).toBe(0);
    expect(section.querySelectorAll('h3').length).toBe(0);
  });
});

// ─── Static Check: ALL_SEED_PRODUCTS must not appear in HomePage.tsx ────────

describe('Static check: seed-data removal', () => {
  it('ALL_SEED_PRODUCTS no longer appears anywhere in HomePage.tsx', () => {
    const content = readFileSync(HOME_PAGE_PATH, 'utf-8');
    expect(content).not.toContain('ALL_SEED_PRODUCTS');
  });
});
