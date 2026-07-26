# Production Hardening Tasks

## Task List

- [ ] 1. Fix Analytics Event Persistence
  - Remove the `analytics/` short-circuit stub `if (path.startsWith('analytics/')) return res.status(200).json({ ok: true });` from `api/[[...route]].ts`
  - Fix the duplicate `import { requireAdmin }` (two identical import lines) in `api/_lib/handlers/analytics.ts`
  - Fix the duplicate `if (!requireAdmin(req, res)) return;` guard in the `dashboard` function in `api/_lib/handlers/analytics.ts`
  - Verify the existing `handleAnalytics` call at the bottom of `[[...route]].ts` covers both `analytics/event` and `analytics/dashboard`
  - Add regression test `tests/unit/analyticsEventRoute.test.ts` that mocks `handleAnalytics` and verifies it is called when the path is `analytics/event`
  - _Requirements: REQ-1_

- [ ] 2. Protect Debug Endpoints
  - Add `import { requireAdmin } from '../_lib/adminAuth.js';` to `api/_lib/handlers/debug.ts`
  - Add `if (!requireAdmin(req, res)) return;` as the first line of `handleDebug` before any routing
  - Add regression test `tests/unit/debugEndpointSecurity.test.ts` that verifies `handleDebug` returns 401 for unauthenticated requests and 403 for non-admin users
  - _Requirements: REQ-2_

- [ ] 3. Schedule Missing Cron Jobs
  - Add `{ "path": "/api/cron/deals-refresh", "schedule": "0 */6 * * *" }` to the `crons` array in `vercel.json`
  - Add `{ "path": "/api/cron/populate-catalog", "schedule": "0 4 * * *" }` to the `crons` array in `vercel.json`
  - Add `console.log('[deals-refresh] starting ...')` at the top of the handler and `console.log('[deals-refresh] cleaned N deals')` on completion in `api/cron/deals-refresh.ts`
  - Add `console.log('[populate-catalog] starting ...')` at the top of the handler and a completion log in `api/cron/populate-catalog.ts`
  - Verify both cron handlers have a `try/catch` block returning a 500 JSON error on failure
  - _Requirements: REQ-3_

- [ ] 4. Consolidate Price Formatters
  - In `src/utils/formatPrice.ts`: add `export const formatINR = formatPrice;` and `export const discountPercent = calculateDiscount;` as alias exports at the bottom of the file
  - Replace the body of `src/utils/format.ts` with re-exports: `export { formatPrice as formatINR, calculateDiscount as discountPercent } from './formatPrice';` — this keeps all existing callers working
  - In `src/pages/SearchPage.tsx`: remove the inline `function formatPrice(price: number)` and add `import { formatPrice } from '../utils/formatPrice';` at the top of the file
  - Add regression test `tests/unit/formatPriceConsolidation.test.ts` that verifies `formatINR`, `formatPrice`, and `discountPercent` all exist and produce identical output to their originals
  - _Requirements: REQ-4_

- [ ] 5. Wishlist Real Price History
  - In `api/_lib/handlers/wishlist.ts` `index` GET handler: after fetching wishlist items, import `PriceHistory` model and run one query to get the last 7 price entries per item title, then attach `priceHistory: number[]` to each item in the response (oldest-first, empty array if none found)
  - In `src/pages/WishlistPage.tsx`: add `priceHistory?: number[]` to the `WishlistItem` interface, remove the `mockPriceHistory()` function, and replace `const sparkData = mockPriceHistory()` with `const sparkData = item.priceHistory ?? []`
  - Add regression test `tests/unit/wishlistPriceHistory.test.ts` that mocks `PriceHistory.find` and verifies the handler returns `priceHistory` arrays on wishlist items
  - _Requirements: REQ-5_

- [ ] 6. Remove Dead Code
  - Use grep to verify zero live imports for each of: `GetStarted.tsx`, `EarlyJoin.tsx`, `LaunchingSoon.tsx`, `FeaturesPage.tsx`, `PriceHistory.tsx` (component), `PriceChart.tsx`
  - Delete `src/pages/GetStarted.tsx`, `src/pages/EarlyJoin.tsx`, `src/pages/LaunchingSoon.tsx`
  - Delete `src/pages/FeaturesPage.tsx` if confirmed not imported
  - Delete `src/components/product/PriceHistory.tsx` and `src/components/product/PriceChart.tsx` if confirmed not imported
  - Run `npm run build` and verify no TypeScript errors from the deletions
  - _Requirements: REQ-6_
