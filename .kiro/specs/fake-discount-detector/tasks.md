# Implementation Plan: Fake Discount Detector

## Overview

Implement a pure client-side Deal Verdict Badge that classifies each product offer as a genuine deal, inflated MRP, or suspicious price increase — reusing `PriceStats` data that `usePriceHistory` already caches. The work is split into four layers: the pure engine, the badge component, integration into `ProductDetailPage` and `DealsPage`, and property-based correctness tests.

## Tasks

- [x] 1. Implement the `DealVerdict` type and `analyzeDeal` engine
  - Create `src/utils/dealVerdict.ts`
  - Export the `DealVerdict` interface with fields `verdict`, `badge`, `detail`, `saving`
  - Export `VerdictCode` union type: `'genuine' | 'inflated_mrp' | 'suspicious' | 'insufficient_data'`
  - Import `PriceStats` from `../hooks/usePriceHistory` (already exported)
  - Implement `analyzeDeal(currentPrice, platformOriginalPrice, stats, snapshotCount): DealVerdict | null` using the priority table in the design: `insufficient_data` → `genuine` → `inflated_mrp` → `suspicious` → `null`
  - Set `saving = Math.max(0, (platformOriginalPrice ?? 0) > currentPrice ? (platformOriginalPrice! - currentPrice) : 0)`
  - Set badge/detail strings exactly as specified in the design (use `formatPrice` from `../utils/formatPrice` for currency strings in detail)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 1.1 Write property tests for `analyzeDeal` (Properties 1–9)
    - Create `tests/properties/dealVerdict.prop.ts`
    - Use `fast-check` (`fc`) consistent with `tests/properties/search.prop.ts`
    - Define a `priceStatsArb` arbitrary: `lowestPrice` and `highestPrice` both `fc.integer({min:1, max:100000})` with `lowestPrice <= highestPrice` enforced via `fc.filter` or `fc.chain`
    - **Property 1: Insufficient data always wins** — `fc.property(fc.integer({min:0,max:2}), priceStatsArb, ...)` → assert `verdict === 'insufficient_data'`; `// Feature: fake-discount-detector, Property 1`
    - **Property 2: Genuine deal classification** — constrain `currentPrice` to `[1, Math.floor(stats.lowestPrice * 1.05)]`, `snapshotCount >= 3` → assert `verdict === 'genuine'`; `// Feature: fake-discount-detector, Property 2`
    - **Property 3: Inflated MRP classification** — `currentPrice > lowestPrice * 1.05`, `platformOriginalPrice > highestPrice * 1.5`, `snapshotCount >= 3` → assert `verdict === 'inflated_mrp'`; `// Feature: fake-discount-detector, Property 3`
    - **Property 4: Suspicious classification** — all three exclusion conditions met + suspicious conditions → assert `verdict === 'suspicious'`; `// Feature: fake-discount-detector, Property 4`
    - **Property 5: Output is always valid or null** — fully unconstrained arbitrary → assert result is `null` or verdict is one of the four valid codes; `// Feature: fake-discount-detector, Property 5`
    - **Property 6: Saving ≥ 0** — any input producing non-null verdict → assert `result.saving >= 0`; `// Feature: fake-discount-detector, Property 6`
    - **Property 7: Saving arithmetic** — assert `result.saving === Math.max(0, orig > cur ? orig - cur : 0)`; `// Feature: fake-discount-detector, Property 7`
    - **Property 8: inflated_mrp detail string** — assert detail contains platformOriginalPrice and stats.highestPrice values; `// Feature: fake-discount-detector, Property 8`
    - **Property 9: suspicious detail string** — assert detail contains stats.lowestPrice value; `// Feature: fake-discount-detector, Property 9`
    - Each `fc.assert` call must run at minimum 100 iterations (fast-check default is 100; do not lower it)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [~] 2. Checkpoint — run tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement `DealVerdictBadge` React component
  - Create `src/components/ui/DealVerdictBadge.tsx`
  - Accept `verdict: DealVerdict | null` prop
  - Return `null` when `verdict` is `null` or `verdict.verdict === 'insufficient_data'`
  - Render a pill badge using Tailwind classes from the design system palette:
    - `genuine` → `bg-emerald-50 text-emerald-700 border border-emerald-100`
    - `inflated_mrp` → `bg-red-50 text-red-700 border border-red-100`
    - `suspicious` → `bg-amber-50 text-amber-700 border border-amber-100`
  - Include `aria-label={`${verdict.badge}: ${verdict.detail}`}` on the outer `<span>`
  - Display `verdict.badge` as the main text and `verdict.detail` as a smaller secondary line
  - No inline styles; no new CSS files; Tailwind only
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 3.1 Write property test for `DealVerdictBadge` aria-label (Property 10)
    - In `tests/properties/dealVerdict.prop.ts`, add a test using `@testing-library/react` + `fc`
    - Define `dealVerdictArb` arbitrary that generates `DealVerdict` objects with visible verdict codes (`genuine`, `inflated_mrp`, `suspicious`)
    - Render `<DealVerdictBadge verdict={v} />` inside each property iteration
    - Assert the rendered element's `aria-label` attribute contains both `v.badge` and `v.detail`
    - **Property 10: DealVerdictBadge aria-label combines badge and detail**; `// Feature: fake-discount-detector, Property 10`
    - _Requirements: 3.7_

- [x] 4. Integrate badge into `ProductDetailPage` — `OfferRow`
  - In `src/pages/ProductDetailPage.tsx`:
    - Import `usePriceHistory` at the page level (it may already be imported indirectly — add it explicitly at page scope)
    - Add a `priceHistory` hook instance at page level: `const priceHistory = usePriceHistory()`
    - When the Price History panel is toggled open, call `priceHistory.fetch(canonicalId)` in addition to the existing `PriceHistoryPanel` call
    - When `priceHistory.status === 'success'` and `priceHistory.stats !== null`, compute `snapshotCount = priceHistory.points.length`
    - Pass `verdict?: DealVerdict | null` prop to `OfferRow`, computed by calling `analyzeDeal(offer.price, offer.originalPrice, priceHistory.stats, snapshotCount)` for each offer — only when stats are available
    - In `OfferRow`, import `DealVerdictBadge` and render `<DealVerdictBadge verdict={verdict ?? null} />` below the price/discount line, inside the offer content area
    - While `priceHistory.status !== 'success'` no badge is shown — no skeleton, no placeholder
    - No additional API calls are made by this integration
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Integrate badge into `DealsPage` — `DealCard`
  - In `src/pages/DealsPage.tsx`:
    - Convert `DealCard` to use its own `usePriceHistory` hook instance
    - On mount (via `useEffect`), call `hook.fetch(deal._id)` — the hook's cache ensures one call per unique `_id`
    - When `hook.status === 'success'` and `hook.stats !== null`, compute `snapshotCount = hook.points.length` and call `analyzeDeal(deal.currentPrice, deal.originalPrice, hook.stats, snapshotCount)`
    - Render `<DealVerdictBadge verdict={verdict} />` below the discount percentage badge (the existing `{deal.dropPercent}% off` span), inside the price block area
    - When `hook.status !== 'success'`, render nothing for the badge (silent loading)
    - Import `analyzeDeal` from `../../utils/dealVerdict` and `DealVerdictBadge` from `../../components/ui/DealVerdictBadge`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Checkpoint — run tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Add cache-only badge to `SearchPage` — `ResultCard`
  - In the search result card component (locate `ResultCard` or equivalent inside `src/pages/SearchPage.tsx` or `src/components/search/`):
    - Import `usePriceHistory` — use the existing hook instance if one is already in scope, or create a new page-level one
    - Expose a helper that reads from the hook's cache without calling `fetch`: check `hook.status` and `hook.stats` only if the canonical ID matches the currently-loaded ID; otherwise treat as cache miss
    - If cache is populated (`hook.stats !== null`), compute `snapshotCount = hook.points.length` and call `analyzeDeal`; pass result to `<DealVerdictBadge />`
    - If cache is cold, render nothing — **do NOT call `hook.fetch`** from result cards
    - No degradation to search result render time
  - _Requirements: 6.1, 6.2, 6.3_

- [~] 8. Final checkpoint — Ensure all tests pass
  - Run `npx vitest --run` to execute the full test suite including property tests
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `formatPrice` from `src/utils/formatPrice.ts` is used inside `analyzeDeal` for the currency strings embedded in `detail` — no new formatting utility needed
- `usePriceHistory` caching is keyed on `canonicalId::days::platform`; default (`days=30`, `platform=undefined`) is appropriate for badge computation
- The `snapshotCount` passed to `analyzeDeal` should equal `points.length` from `usePriceHistory` — this is the count of historical data points within the selected window (default 30 days)
- Property tests live in `tests/properties/dealVerdict.prop.ts` consistent with the existing `search.prop.ts` and `homeDealsCard.prop.ts` patterns

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] },
    { "wave": 4, "tasks": ["4", "5"] },
    { "wave": 5, "tasks": ["6"] },
    { "wave": 6, "tasks": ["7"] },
    { "wave": 7, "tasks": ["8"] }
  ]
}
```
