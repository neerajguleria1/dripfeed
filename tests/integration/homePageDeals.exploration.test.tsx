// @vitest-environment jsdom
/**
 * Property 1: Bug Condition - Real Deals Data Sourcing
 * Validates: Requirements 1.1, 1.2, 1.3
 *
 * This file was originally written (task 1) as a bug-condition EXPLORATION
 * test against the CURRENT (unfixed) `Website/src/pages/HomePage.tsx`:
 *
 *   - Test Case 1 (no API call) was EXPECTED TO FAIL on unfixed code — the
 *     "was called" assertion failed because HomePage never called `api.get`
 *     for '/products/deals' or '/products/trending'. That failure WAS the
 *     counterexample proving the bug existed.
 *   - Test Cases 2-4 originally PASSED on unfixed code, encoding the buggy
 *     behavior itself (seed data rendered unconditionally, real/absent API
 *     data ignored) as further counterexample evidence.
 *
 * After the fix (task 3) landed and task 3.7 confirmed Test Case 1 now
 * passes, Test Cases 2-4 were rewritten to assert the CORRECT fetch-chain
 * behavior instead of the old buggy assumptions — they no longer encode
 * pre-fix behavior. This file now serves two purposes:
 *
 *   1. Test Case 1 remains the original bug-condition proof (unchanged).
 *   2. Test Cases 2-4 are a permanent regression suite for the
 *      deals → trending → empty-state fallback chain, guarding against the
 *      bug (or an equivalent seed-data-masking regression) being reintroduced.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import api from '../../src/services/api';
import { ALL_SEED_PRODUCTS } from '../../api/_lib/seed-data';
import HomePage from '../../src/pages/HomePage';
import { AuthProvider } from '../../src/context/AuthContext';

vi.mock('../../src/services/api');

const mockedApiGet = api.get as unknown as ReturnType<typeof vi.fn>;

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

/** Reads the rendered deal titles from the "Today's biggest drops" grid. */
function getRenderedDealTitles(): string[] {
  const heading = screen.getByText("Today's biggest drops");
  const section = heading.closest('section');
  if (!section) return [];
  // Deal card titles are rendered as <h3> elements inside the grid.
  return Array.from(section.querySelectorAll('h3')).map((el) => el.textContent?.trim() ?? '');
}

describe('Property 1: Bug Condition - Real Deals Data Sourcing (exploration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('Test Case 1: HomePage never calls the real deals/trending APIs (EXPECTED TO FAIL on unfixed code)', async () => {
    mockedApiGet.mockResolvedValue({ data: { deals: [], total: 0 } });

    renderHomePage();

    // Give the component a tick to run any effects, then assert a real
    // network call was made. On unfixed code this assertion fails because
    // no `api.get` call is ever issued — that failure is the counterexample.
    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith('/products/deals');
    });
  });

  it('Test Case 2: when the API mock has no implementation, the section falls through to the empty-state (no seed data ever renders)', async () => {
    // No mock configured for this call — mockedApiGet has no implementation
    // (`vi.mock('../../src/services/api')` auto-mocks `api.get` to return
    // `undefined`). Destructuring `{ data }` off `undefined` throws inside
    // `loadDeals`, so the deals-fetch attempt falls through to the
    // trending-fetch attempt, which throws for the same reason, landing the
    // section in the 'empty' state. No seed data should ever render.
    renderHomePage();

    await screen.findByText(/No new deals right now/i);

    const titles = getRenderedDealTitles();
    expect(titles.length).toBe(0);
    for (const title of ALL_SEED_PRODUCTS.map((sp) => sp.title)) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });

  it('Test Case 3: a real deal returned by the API is rendered correctly', async () => {
    mockedApiGet.mockImplementation((url: string) => {
      if (url === '/products/deals') {
        return Promise.resolve({
          data: {
            deals: [
              {
                id: 'x',
                productTitle: 'REAL-DEAL-MARKER',
                brand: 'B',
                imageUrl: 'i',
                platform: 'myntra',
                currentPrice: 100,
                previousPrice: 200,
                dropPercentage: 50,
                url: 'u',
                detectedAt: '',
                trackersCount: 0,
              },
            ],
            total: 1,
          },
        });
      }
      return Promise.resolve({ data: { products: [], total: 0 } });
    });

    renderHomePage();

    await expect(screen.findByText('REAL-DEAL-MARKER')).resolves.toBeInTheDocument();
  });

  it('Test Case 4: an empty deals response falls back to trending, and to the empty-state message if trending is also empty', async () => {
    // Sub-case A: deals empty, trending has real data — trending is rendered.
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
                title: 'TRENDING-FALLBACK-MARKER',
                brand: 'B',
                imageUrl: 'i',
                price: 100,
                originalPrice: 200,
                discount: 50,
                platform: 'myntra',
                url: 'u',
              },
            ],
            total: 1,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderHomePage();

    await expect(screen.findByText('TRENDING-FALLBACK-MARKER')).resolves.toBeInTheDocument();
    for (const title of ALL_SEED_PRODUCTS.map((sp) => sp.title)) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });

  it('Test Case 4b: both deals and trending empty falls to the empty-state message', async () => {
    // Sub-case B: both deals and trending resolve empty — empty-state shown.
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

    await screen.findByText(/No new deals right now/i);

    const titles = getRenderedDealTitles();
    expect(titles.length).toBe(0);
    for (const title of ALL_SEED_PRODUCTS.map((sp) => sp.title)) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });
});
