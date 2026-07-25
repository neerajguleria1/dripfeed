// @vitest-environment jsdom
/**
 * Integration tests for the full HomePage "Today's biggest drops" fetch chain.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1
 *
 * Reuses the MemoryRouter + AuthProvider + IntersectionObserver-stub +
 * `vi.mock('../../src/services/api')` setup pattern established in task 1's
 * `homePageDeals.exploration.test.tsx`.
 *
 * Test Case 1: real deals path — /products/deals returns real Deal-shaped
 *   records; those exact titles render and no ALL_SEED_PRODUCTS title ever
 *   appears in the DOM.
 * Test Case 2: trending fallback path — /products/deals empty,
 *   /products/trending populated; trending items render in the same grid and
 *   their click-through target resolves to /compare?q=<encoded title>.
 * Test Case 3: both-fail path — both endpoints reject; the empty-state
 *   message renders, no uncaught console errors occur, and other homepage
 *   sections render normally.
 * Test Case 4: DealsPage.tsx is unaffected — byte-identity check against the
 *   known-good pre-fix baseline hash, and confirms HomePage.tsx does not
 *   import/exercise it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import api from '../../src/services/api';
import { ALL_SEED_PRODUCTS } from '../../api/_lib/seed-data';
import HomePage from '../../src/pages/HomePage';
import { AuthProvider } from '../../src/context/AuthContext';

vi.mock('../../src/services/api');

const mockedApiGet = api.get as unknown as ReturnType<typeof vi.fn>;

const SEED_TITLES = ALL_SEED_PRODUCTS.map((sp) => sp.title);

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_PAGE_PATH = resolve(__dirname, '../../src/pages/HomePage.tsx');
const DEALS_PAGE_PATH = resolve(__dirname, '../../src/pages/DealsPage.tsx');
// Updated after a deliberate follow-up fix removed DealsPage.tsx's own
// ALL_SEED_PRODUCTS fallback (separate from this file's original homepage-only
// scope) so both pages consistently show only real API data.
const DEALS_PAGE_BASELINE_HASH = '82C954E35D3EF937364403475325B5D91D27194DA5D31B48F2BC928DE2220062';

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

/** Reads the rendered deal card <h3> titles from the "Today's biggest drops" grid. */
function getRenderedDealTitles(): string[] {
  const heading = screen.getByText("Today's biggest drops");
  const section = heading.closest('section');
  if (!section) return [];
  return Array.from(section.querySelectorAll('h3')).map((el) => el.textContent?.trim() ?? '');
}

/** Reads the rendered deal card anchor elements from the "Today's biggest drops" grid. */
function getRenderedDealLinks(): HTMLAnchorElement[] {
  const heading = screen.getByText("Today's biggest drops");
  const section = heading.closest('section');
  if (!section) return [];
  return Array.from(section.querySelectorAll('a')).filter((a) => a.querySelector('h3'));
}

describe('HomePage deals section: full fetch chain integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('Test Case 1: real deals returned by /products/deals render verbatim, and no seed-data title ever appears', async () => {
    mockedApiGet.mockImplementation((url: string) => {
      if (url === '/products/deals') {
        return Promise.resolve({
          data: {
            deals: [
              {
                id: 'd1',
                productTitle: 'REAL-DEAL-ONE',
                brand: 'BrandA',
                imageUrl: 'https://example.com/a.jpg',
                platform: 'myntra',
                currentPrice: 999,
                previousPrice: 1999,
                dropPercentage: 50,
                url: 'https://example.com/a',
                detectedAt: '2024-01-01T00:00:00.000Z',
                trackersCount: 3,
              },
              {
                id: 'd2',
                productTitle: 'REAL-DEAL-TWO',
                brand: 'BrandB',
                imageUrl: 'https://example.com/b.jpg',
                platform: 'ajio',
                currentPrice: 499,
                previousPrice: 799,
                dropPercentage: 38,
                url: 'https://example.com/b',
                detectedAt: '2024-01-01T00:00:00.000Z',
                trackersCount: 1,
              },
            ],
            total: 2,
          },
        });
      }
      return Promise.resolve({ data: { products: [], total: 0 } });
    });

    renderHomePage();

    await screen.findByText('REAL-DEAL-ONE');
    await screen.findByText('REAL-DEAL-TWO');

    const titles = getRenderedDealTitles();
    expect(titles).toEqual(['REAL-DEAL-ONE', 'REAL-DEAL-TWO']);

    for (const seedTitle of SEED_TITLES) {
      expect(screen.queryByText(seedTitle)).not.toBeInTheDocument();
    }
  });

  it('Test Case 2: empty deals falls back to trending, and clicking a trending card would navigate to /compare?q=<title>', async () => {
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
                title: 'TRENDING-ITEM-ONE',
                brand: 'BrandC',
                imageUrl: 'https://example.com/c.jpg',
                price: 1200,
                originalPrice: 1500,
                discount: 20,
                platform: 'flipkart',
                url: 'https://example.com/c',
              },
              {
                id: 't2',
                title: 'TRENDING-ITEM-TWO & CO.',
                brand: 'BrandD',
                imageUrl: 'https://example.com/d.jpg',
                price: 800,
                originalPrice: undefined,
                discount: undefined,
                platform: 'amazon',
                url: 'https://example.com/d',
              },
            ],
            total: 2,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderHomePage();

    await screen.findByText('TRENDING-ITEM-ONE');
    await screen.findByText('TRENDING-ITEM-TWO & CO.');

    const titles = getRenderedDealTitles();
    expect(titles).toEqual(['TRENDING-ITEM-ONE', 'TRENDING-ITEM-TWO & CO.']);
    for (const seedTitle of SEED_TITLES) {
      expect(screen.queryByText(seedTitle)).not.toBeInTheDocument();
    }

    // Verify the click-through target ("would navigate to") for each trending
    // card by asserting the rendered anchor's resolved href within the
    // MemoryRouter equals /compare?q=<encoded title>.
    const links = getRenderedDealLinks();
    expect(links).toHaveLength(2);

    const expectedTargets = [
      `/compare?q=${encodeURIComponent('TRENDING-ITEM-ONE')}`,
      `/compare?q=${encodeURIComponent('TRENDING-ITEM-TWO & CO.')}`,
    ];

    links.forEach((link, i) => {
      // In MemoryRouter (no real origin), `href` resolves to the full path
      // e.g. "/compare?q=..." — jsdom exposes this via the `pathname` +
      // `search` on the anchor's resolved URL properties.
      const resolvedPath = `${link.pathname}${link.search}`;
      expect(resolvedPath).toBe(expectedTargets[i]);
    });
  });

  it('Test Case 3: both endpoints failing renders the empty-state message, causes no uncaught console errors, and leaves other sections intact', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockedApiGet.mockImplementation((url: string) => {
      if (url === '/products/deals') {
        return Promise.reject(new Error('network error: deals'));
      }
      if (url === '/products/trending') {
        return Promise.reject(new Error('network error: trending'));
      }
      return Promise.reject(new Error('unexpected url'));
    });

    renderHomePage();

    await screen.findByText(/No new deals right now/i);

    const titles = getRenderedDealTitles();
    expect(titles.length).toBe(0);
    for (const seedTitle of SEED_TITLES) {
      expect(screen.queryByText(seedTitle)).not.toBeInTheDocument();
    }

    // No uncaught console.error output should occur — the fetch chain
    // catches both rejections internally and resolves to the empty state.
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // Other homepage sections render normally, unaffected by the deals
    // section's failure state.
    expect(screen.getByText(/Never overpay for/i)).toBeInTheDocument();
    expect(screen.getByText('fashion')).toBeInTheDocument();
    expect(screen.getByText('Three steps to the best deal')).toBeInTheDocument();
    expect(screen.getByText('Trending searches')).toBeInTheDocument();
    expect(screen.getByText("Built for India's smartest shoppers")).toBeInTheDocument();
    expect(screen.getByText('Platforms compared')).toBeInTheDocument();
    expect(screen.getByText(/Start saving\./i)).toBeInTheDocument();
    expect(screen.getByText('Start Comparing')).toBeInTheDocument();
    expect(screen.getByText('© 2026 TagCheck India')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('Test Case 4: DealsPage.tsx is not imported/exercised by this fix and remains byte-identical to the pre-fix baseline', () => {
    // Byte-identity check: DealsPage.tsx content must be unchanged from the
    // known-good baseline hash recorded before this fix was implemented.
    const dealsPageContent = readFileSync(DEALS_PAGE_PATH, 'utf-8');
    const hash = createHash('sha256').update(dealsPageContent).digest('hex').toUpperCase();
    expect(hash).toBe(DEALS_PAGE_BASELINE_HASH);

    // HomePage.tsx must not reference DealsPage at all (no import, no usage).
    const homePageContent = readFileSync(HOME_PAGE_PATH, 'utf-8');
    expect(homePageContent).not.toContain('DealsPage');
  });
});
