# Production Hardening Requirements

## Introduction

This spec covers the final production-hardening pass for the DripFeed Website.
No new user-facing features are added. All changes fix architectural issues,
complete incomplete implementations, remove dead code, and close security gaps
identified in the codebase audit.

## Requirements

### REQ-1: Analytics Event Persistence

**Problem:** The main API router `[[...route]].ts` has a short-circuit guard that
intercepts all `analytics/` paths and returns `{ ok: true }` before the real
`handleAnalytics` dispatcher is reached. As a result, every analytics event
fired by the frontend is silently discarded.

Additionally, `handlers/analytics.ts` contains a duplicate `import { requireAdmin }`
statement which is a TypeScript compile error.

**Acceptance Criteria:**
1. Remove the short-circuit stub from `[[...route]].ts` so all `/api/analytics/*`
   requests reach `handleAnalytics`.
2. Fix the duplicate `import { requireAdmin }` in `handlers/analytics.ts`.
3. Fix the duplicate `if (!requireAdmin(req, res)) return;` guard in the dashboard
   function inside `handlers/analytics.ts`.
4. `POST /api/analytics/event` must persist events via `enqueueEvent` (already
   implemented in the handler — routing was the only problem).
5. `GET /api/analytics/dashboard` must remain admin-protected.
6. Existing batching, queueing, and aggregation logic must not change.
7. Add a regression test: `tests/unit/analyticsEventRoute.test.ts` that verifies
   `handleAnalytics` is called for `analytics/event` and `analytics/dashboard`.

### REQ-2: Debug Endpoint Security

**Problem:** `GET /api/debug/*` endpoints (`/debug/search`, `/debug/search-old`,
`/debug/live`) expose internal ScraperAPI keys, platform scraper diagnostics, and
full product data without any authentication. This is a direct credential leak
risk in production.

**Acceptance Criteria:**
1. Add `requireAdmin(req, res)` guard at the top of `handleDebug` before any
   routing.
2. Return 401/403 for unauthenticated/non-admin requests.
3. Add a regression test: `tests/unit/debugEndpointSecurity.test.ts`.

### REQ-3: Missing Cron Job Schedules

**Problem:** `api/cron/deals-refresh.ts` and `api/cron/populate-catalog.ts`
are implemented but not scheduled in `vercel.json`. `deals-refresh` deactivates
expired deals; without it running, stale deals accumulate indefinitely.

**Acceptance Criteria:**
1. Add `deals-refresh` to `vercel.json` crons: schedule `"0 */6 * * *"` (every 6h).
2. Add `populate-catalog` to `vercel.json` crons: schedule `"0 4 * * *"` (daily 4am).
3. Verify `deals-refresh.ts` handles method validation and DB errors.
4. Verify `populate-catalog.ts` is idempotent and has error handling.
5. Add logging to both cron handlers (console.log on start/completion/error).

### REQ-4: Price Formatter Consolidation

**Problem:** Three separate price formatters exist:
- `src/utils/formatPrice.ts` — exports `formatPrice(amount: number)`, `calculateDiscount`, `formatSavings`
- `src/utils/format.ts` — exports `formatINR(amount)`, `discountPercent`
- `SearchPage.tsx` — inline `function formatPrice(price: number)` duplicating the util

`formatPrice.ts` and `format.ts` both format INR but with different function names
and slightly different null-handling.

**Acceptance Criteria:**
1. Consolidate into `src/utils/formatPrice.ts`:
   - Keep `formatPrice` (already there).
   - Add `formatINR` as an alias export pointing to `formatPrice` (for backward compat with callers using `formatINR`).
   - Keep `calculateDiscount` and `formatSavings`.
   - Add `discountPercent` as an alias for `calculateDiscount` (for backward compat).
2. Update `src/utils/format.ts` to re-export from `formatPrice.ts` instead of
   duplicating logic. This preserves all existing import paths.
3. Remove the inline `formatPrice` function from `SearchPage.tsx` and import
   from `../utils/formatPrice` instead.
4. All existing callers (`WishlistPage`, `AdminPage`, `DealsPage`, etc.) must
   continue to work without changes (ensured by re-export in `format.ts`).
5. Add a regression test: `tests/unit/formatPriceConsolidation.test.ts`.

### REQ-5: Wishlist Sparkline Real Data

**Problem:** `WishlistPage.tsx` generates sparkline data with `mockPriceHistory()`
— a random number generator called on every render — instead of real price history.
This shows users misleading price trend charts.

**Acceptance Criteria:**
1. The wishlist `GET /api/wishlist` handler (`handlers/wishlist.ts`) must enrich
   each item with its last 7 real price snapshots from `PriceHistory` collection,
   keyed by `productTitle` (since wishlist items don't have a `canonicalId`).
2. Return a `priceHistory: number[]` field (array of prices, oldest first,
   up to 7 entries) on each wishlist item response object.
3. If no price history exists for an item, return `priceHistory: []`.
4. `WishlistPage.tsx` must use the real `priceHistory` array from the API response
   instead of calling `mockPriceHistory()`.
5. The `mockPriceHistory` function must be removed from `WishlistPage.tsx`.
6. The `Sparkline` component already supports empty arrays — show nothing if empty.
7. Add a test: `tests/unit/wishlistPriceHistory.test.ts`.

### REQ-6: Dead Code and Duplicate Component Removal

**Problem:** Several unused/orphaned pages and duplicate components exist:
- `src/pages/GetStarted.tsx`, `EarlyJoin.tsx`, `LaunchingSoon.tsx` — not in any route
- `src/components/product/PriceHistory.tsx` and `PriceChart.tsx` — superseded by `PriceHistoryPanel.tsx`
- `src/pages/FeaturesPage.tsx` — not in `App.tsx` routes

**Acceptance Criteria:**
1. Delete `src/pages/GetStarted.tsx`, `src/pages/EarlyJoin.tsx`, `src/pages/LaunchingSoon.tsx`.
2. Delete `src/components/product/PriceHistory.tsx` and `src/components/product/PriceChart.tsx` if they are not imported anywhere.
3. Delete `src/pages/FeaturesPage.tsx` if not imported anywhere.
4. Verify with grep that deleted files have no live imports before deleting.
5. Build must pass after deletions.
