# Implementation Plan: Content-First Homepage

## Overview

Replace the marketing-style hero homepage with a content-first product discovery feed. Implementation uses the existing Vercel serverless API (Hono-style handlers via `handleFeed`), React 19 + Vite frontend with Tailwind v4, and fast-check for property-based tests. The approach builds backend → shared types/mappers → frontend components → homepage assembly → performance optimizations → tests.

## Tasks

- [x] 1. Backend: Feed API endpoints and caching layer
  - [x] 1.1 Create LRU cache utility at `api/_lib/cache.ts`
    - Implement generic `CacheEntry<T>` with TTL-based expiry
    - Export `cacheGet<T>(key)`, `cacheSet<T>(key, data, ttl)`, `cacheInvalidate(key)` functions
    - Configure `homeFeed: { ttl: 15min, maxEntries: 10 }` and `discoverFeed: { ttl: 5min, maxEntries: 50 }`
    - Use `Map` with periodic cleanup (no external deps)
    - _Requirements: 8.2, 8.4_

  - [x] 1.2 Create `HomeFeedProduct` mapper at `api/_lib/mappers/homeFeed.ts`
    - Export `HomeFeedProduct` interface (id, title, brand, imageUrl, price, originalPrice, discount, savings, platform, url, category)
    - Implement `mapSeedToHomeFeed(seed: SeedProduct): HomeFeedProduct` — find cheapest platform, compute discount & savings
    - Implement `mapDealApiToHomeFeed(deal: DealApiItem): HomeFeedProduct`
    - Implement `mapTrendingApiToHomeFeed(item: TrendingApiItem): HomeFeedProduct`
    - Savings field populated only when `originalPrice - price > 200`
    - _Requirements: 3.2, 3.3, 2.6_

  - [x] 1.3 Implement `/api/feed/home` endpoint in `api/_lib/handlers/feed.ts`
    - Add `home` case to the existing `handleFeed` switch
    - Query `/products/deals` first, fallback to `/products/trending`, final fallback to `SEED_PRODUCTS`
    - Return `{ products: HomeFeedProduct[], source: 'deals'|'trending'|'seed', cachedAt: string, geo: { country, isIndia } }`
    - Read `x-vercel-ip-country` header for geo detection, default to `'IN'`
    - Set `Cache-Control: s-maxage=900, stale-while-revalidate=1800`
    - Use LRU cache from 1.1 — serve cached if fresh, revalidate in background
    - Sort deal products by highest `discount` descending
    - Return minimum 8, maximum 12 products
    - _Requirements: 2.4, 2.5, 2.6, 8.2, 8.4, 9.2_

  - [x] 1.4 Implement `/api/feed/discover` endpoint in `api/_lib/handlers/feed.ts`
    - Add `discover` case to the `handleFeed` switch
    - Accept query params: `page` (1-5), `category` (optional)
    - Return `{ sections: FeedSection[], page, hasMore, totalPages }`
    - Each section: `{ id, title, products: HomeFeedProduct[] }` with 12 products per page
    - Generate themed sections: "Today's Deals", "Trending Now", "Under ₹999", "Ethnic Favorites"
    - Cap at 5 pages maximum (60 additional products total)
    - Set `Cache-Control: s-maxage=300, stale-while-revalidate=600`
    - Use LRU cache with category+page as key
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 2. Checkpoint - Ensure API endpoints work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Shared types and utilities
  - [x] 3.1 Create shared types at `src/types/homeFeed.ts`
    - Export `HomeFeedProduct`, `HomeFeedResponse`, `DiscoverFeedResponse`, `FeedSection`, `CategoryItem` interfaces
    - Export `FeedState` interface for discovery feed state management
    - These mirror the API response shapes from task 1.3/1.4
    - _Requirements: 2.1, 6.2_

  - [x] 3.2 Create `formatPrice` utility (if not already exported) at `src/utils/formatPrice.ts`
    - Ensure `formatPrice(n: number): string` returns `₹X,XX,XXX` (Indian locale)
    - Handle edge cases: 0, negative, NaN, very large numbers
    - Export for use by ProductCard
    - _Requirements: 3.1, 9.3_

  - [x] 3.3 Create category data constant at `src/data/categories.ts`
    - Export `HOMEPAGE_CATEGORIES: CategoryItem[]` with: "All", "Trending", "Kurta Sets", "Sneakers", "Sarees", "Jeans", "Dresses", "Ethnic Wear"
    - Each item: `{ id, label, query }` — query maps to search term
    - _Requirements: 4.3_

- [x] 4. Custom hooks for homepage data
  - [x] 4.1 Create `useHomeFeed` hook at `src/hooks/useHomeFeed.ts`
    - Accept `category: string` parameter
    - Fetch `/api/feed/home?category=...` with AbortController cleanup
    - Implement 5-second timeout → fallback to seed products (import from `api/_lib/seed-data.ts` mapped via shared mapper)
    - Return `{ products, loading, source, error, geo }`
    - On error/timeout, map SEED_PRODUCTS to HomeFeedProduct[] client-side
    - _Requirements: 2.4, 2.5, 2.6, 5.6, 8.2_

  - [x] 4.2 Create `useDiscoveryFeed` hook at `src/hooks/useDiscoveryFeed.ts`
    - Accept `category: string` parameter
    - Use IntersectionObserver with 200px rootMargin threshold
    - Expose `{ sections, loading, hasMore, loadNext }` — `loadNext()` fetches next page
    - Cap at 5 pages regardless of how many times `loadNext` is called
    - Append sections on each load, track cumulative product count (max 60)
    - _Requirements: 6.1, 6.5_

  - [x] 4.3 Create `useGeoRegion` hook at `src/hooks/useGeoRegion.ts`
    - Read geo data from the `/api/feed/home` response (passed as prop or via context)
    - Fallback heuristic: parse `navigator.language` for non-India locales
    - Track `dismissed` state in localStorage key `"tagcheck_geo_dismissed"`
    - Handle missing localStorage gracefully (private browsing)
    - Return `{ countryCode, isIndia, dismissed, dismiss }`
    - _Requirements: 9.1, 9.2, 9.5_

- [x] 5. Frontend components
  - [x] 5.1 Create `StickyHeader` component at `src/components/homepage/StickyHeader.tsx`
    - 56px height on mobile, 64px on desktop
    - Fixed position, `bg-white/80 backdrop-blur-lg border-b border-neutral-100`
    - Left: Logo (reuse existing `Logo` component), Center: expandable SearchInput, Right: wishlist + account icons
    - On tap → expand search to full width, show suggestions overlay
    - On submit → navigate to `/search?q=...`
    - All tap targets minimum 44x44px
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.1_

  - [x] 5.2 Create `CategoryChips` component at `src/components/homepage/CategoryChips.tsx`
    - Horizontal scrollable row of pill-shaped buttons
    - Use `HOMEPAGE_CATEGORIES` data from task 3.3
    - Active chip: gold background `#C9A96E` with dark text
    - Inactive chips: neutral border, neutral text
    - `overflow-x-auto` with momentum scrolling, no wrapping
    - `onSelect(category)` callback to parent
    - Minimum 44px height per chip for touch targets
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.1, 7.5_

  - [x] 5.3 Create `HomeProductGrid` component at `src/components/homepage/HomeProductGrid.tsx`
    - Accept `products: HomeFeedProduct[]`, `loading: boolean`
    - Responsive grid: 2 columns (mobile <640px), 3 columns (640-1024px), 4 columns (>1024px)
    - Gap: 8px mobile, 12px desktop
    - When `loading=true`, render skeleton placeholders (min 6 mobile, 8 desktop)
    - Use existing `ProductSkeleton` pattern (aspect-[3/4] image area + title + price lines)
    - Skeleton pulse animation: opacity oscillation 0.4-1.0
    - Fade-in transition (300ms) when swapping skeletons for real cards
    - Each card uses the enhanced ProductCard (task 5.4)
    - First `columns * 2` images: `loading="eager"`, rest: `loading="lazy"`
    - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3, 5.4, 5.5, 7.2, 7.4, 8.5_

  - [x] 5.4 Create enhanced `HomeFeedCard` component at `src/components/homepage/HomeFeedCard.tsx`
    - Display: product image (3:4 aspect), title (2-line clamp), price (₹ formatted), platform badge
    - Show strikethrough original price + discount badge ("−32%") when `originalPrice > price`
    - Show "Save ₹X" label when `savings > 200`
    - Platform badge with brand color dot (Ajio:#000, Amazon:#FF9900, Flipkart:#2874F0, Myntra:#FF3F6C, Meesho:#570741)
    - On tap → navigate to `/compare?q=<encoded title>`
    - Include explicit Compare button affordance
    - Accept `loading` prop for eager/lazy image strategy
    - Image fallback: show 🛍️ icon + brand name on load error
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.4_

  - [x] 5.5 Create `DiscoveryFeed` component at `src/components/homepage/DiscoveryFeed.tsx`
    - Use `useDiscoveryFeed` hook from task 4.2
    - Render sections with headers ("Today's Deals", "Under ₹999", etc.)
    - Each section renders a grid of `HomeFeedCard` components
    - IntersectionObserver trigger div at bottom (200px before viewport end)
    - Loading state: show 3 skeleton cards at bottom
    - End state: "You've seen it all! Try searching for something specific" message
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 5.6 Create `GeoBanner` component at `src/components/homepage/GeoBanner.tsx`
    - Conditional render: show only when `isIndia === false` AND not dismissed
    - Display: "TagCheck currently compares prices from Indian fashion platforms. Global platforms coming soon."
    - Dismissible with X button → calls `dismiss()` from `useGeoRegion`
    - Positioned below CategoryChips, above ProductGrid
    - _Requirements: 9.1, 9.4, 9.5_

  - [x] 5.7 Create `BackToTopButton` component at `src/components/homepage/BackToTopButton.tsx`
    - Floating button, appears after scrolling 800px
    - On click → smooth scroll to top of ProductGrid
    - Bottom-right position, accessible (aria-label)
    - _Requirements: 6.6_

- [x] 6. Checkpoint - Ensure all component builds pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Homepage assembly and wiring
  - [x] 7.1 Rebuild `src/pages/HomePage.tsx` with content-first layout
    - Replace entire current homepage structure (hero, how-it-works, social proof, CTA sections)
    - New structure: `StickyHeader` → `CategoryChips` → `GeoBanner` (conditional) → `HomeProductGrid` → `DiscoveryFeed` → `BackToTopButton` → Footer
    - Wire `useHomeFeed` with selected category state
    - Wire `useGeoRegion` for geo banner visibility
    - Pass category selection from `CategoryChips` → re-fetch grid products
    - No hero section, no marketing copy above the fold
    - Preserve SEO head (SEOHead component)
    - Use `100dvh` viewport units for initial layout calculation
    - Retain footer with privacy/terms/disclosure links
    - _Requirements: 1.1-1.6, 2.1-2.6, 4.4, 4.5, 7.6_

  - [x] 7.2 Add image preloading in `index.html` or via head injection
    - Dynamically inject `<link rel="preload" as="image">` for first 8 product images when served from cache
    - Implement via a `useEffect` in HomePage that injects preload links into `<head>`
    - Only preload when products come from cache (not during initial skeleton state)
    - _Requirements: 8.3_

  - [x] 7.3 Update route registration (if needed) to ensure `/` loads new HomePage
    - Verify the existing route in React Router still points to new HomePage
    - Remove old imports that are no longer needed (motion animation variants for hero, etc.)
    - _Requirements: 2.2_

- [x] 8. Checkpoint - Ensure homepage renders end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Performance optimizations
  - [x] 9.1 Configure bundle splitting for homepage route
    - Ensure homepage chunk stays under 120KB gzipped (excluding shared vendor)
    - Use dynamic imports for `DiscoveryFeed` (below the fold) via `React.lazy`
    - Verify with `vite build` + bundle analyzer
    - _Requirements: 8.6_

  - [x] 9.2 Optimize image loading strategy
    - First `columns * visible_rows` images (above fold): `loading="eager"` + `fetchpriority="high"` on first 4
    - All remaining images: `loading="lazy"`
    - Use `decoding="async"` on all product images
    - Implement image error fallback in `HomeFeedCard` (placeholder icon)
    - _Requirements: 8.1, 8.3, 8.5_

- [ ] 10. Property-based tests
  - [ ]* 10.1 Write property test for discount and savings calculation
    - **Property 1: Discount and Savings Calculation Correctness**
    - Generate random `(originalPrice, price)` pairs where `originalPrice > price > 0`
    - Verify discount equals `Math.round((originalPrice - price) / originalPrice * 100)`
    - Verify savings label appears iff `originalPrice - price > 200`
    - Test file: `tests/properties/contentFirstHomepage.prop.ts`
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 10.2 Write property test for category filter consistency
    - **Property 2: Category Filter Consistency**
    - Generate random product arrays with mixed categories and random category selections
    - Verify filtering returns only products matching selected category
    - Verify result is a subset of original dataset
    - Verify "All" returns unfiltered dataset
    - **Validates: Requirements 4.4, 4.5**

  - [ ]* 10.3 Write property test for price formatting round trip
    - **Property 3: Price Formatting Round Trip**
    - Generate random positive finite numbers
    - Verify `formatPrice(n)` starts with "₹"
    - Verify stripping "₹" and commas then parsing yields `Math.round(n)`
    - **Validates: Requirements 3.1, 9.3**

  - [ ]* 10.4 Write property test for seed data fallback completeness
    - **Property 4: Seed Data Fallback Completeness**
    - Feed all `SEED_PRODUCTS` entries through `mapSeedToHomeFeed`
    - Verify each produces valid `HomeFeedProduct` with id, title, price > 0, platform, discount 0-100
    - **Validates: Requirements 2.6, 5.6**

  - [ ]* 10.5 Write property test for infinite scroll pagination bounds
    - **Property 5: Infinite Scroll Pagination Bounds**
    - Generate random sequences of `loadNext()` calls (1-100 calls)
    - Verify total pages never exceeds 5
    - Verify cumulative product count never exceeds 60
    - **Validates: Requirements 6.5**

  - [ ]* 10.6 Write property test for deals sorted by descending discount
    - **Property 6: Deals Sorted by Descending Discount**
    - Generate random arrays of deal products
    - Apply sorting logic, verify every adjacent pair satisfies `products[i].discount >= products[i+1].discount`
    - **Validates: Requirements 2.4**

  - [ ]* 10.7 Write property test for grid item count viewport minimums
    - **Property 7: Grid Item Count Meets Viewport Minimums**
    - Generate random viewport widths (320-1920px)
    - Verify skeleton/card count >= 6 when width < 640px and >= 8 when width >= 640px
    - **Validates: Requirements 2.1, 5.5**

  - [ ]* 10.8 Write property test for image loading strategy by position
    - **Property 8: Image Loading Strategy by Position**
    - Generate random product lists and viewport configs (columns * visible_rows)
    - Verify items within above-fold threshold have `loading="eager"`
    - Verify all other items have `loading="lazy"`
    - **Validates: Requirements 8.3, 8.5**

- [ ] 11. Unit and integration tests
  - [ ]* 11.1 Write unit tests for `mapSeedToHomeFeed`, `mapDealApiToHomeFeed`, `mapTrendingApiToHomeFeed`
    - Test edge cases: missing fields, zero prices, identical platform prices
    - Test discount computation boundary cases
    - Test savings threshold (exactly ₹200, ₹201, ₹199)
    - _Requirements: 2.6, 3.2, 3.3_

  - [ ]* 11.2 Write integration test for homepage feed rendering
    - Mock `/api/feed/home` returning deals → verify sorted by discount, ProductCards rendered
    - Mock empty deals → verify trending fallback
    - Mock both APIs failing → verify seed products appear within 5s
    - Mock infinite scroll → verify max 5 pages loaded
    - Mock category chip selection → verify grid filters
    - Mock non-India geo → verify GeoBanner displays
    - _Requirements: 2.4, 2.5, 2.6, 6.5, 4.4, 9.1_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `handleFeed` handler in `api/_lib/handlers/feed.ts` already supports routing — new endpoints (`home`, `discover`) are added as cases in the existing switch
- Existing `ProductSkeleton` and `PlatformBadge` patterns from `src/components/product/` should be extended, not duplicated
- `fast-check` is already a project dependency (used in existing property tests)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "3.2", "3.3"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "5.1", "5.2", "5.7"] },
    { "id": 4, "tasks": ["5.3", "5.4", "5.5", "5.6"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "9.1", "9.2"] },
    { "id": 7, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8"] },
    { "id": 8, "tasks": ["11.1", "11.2"] }
  ]
}
```
