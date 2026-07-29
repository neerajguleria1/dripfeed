# Design Document — Fake Discount Detector

## Overview

Indian e-commerce platforms inflate their listed MRP to make discounts appear larger than they really are. TagCheck already stores 90 days of price history per product. This feature exposes fake discounts by adding a **Deal Verdict Badge** wherever a product's price is shown on the front-end.

The entire feature is **pure client-side**. No new backend endpoints, no new Mongoose models, and no extra API calls. Badge computation reuses the `PriceStats` object already returned by `GET /price-history/:canonicalId/stats`, which is cached inside `usePriceHistory`.

Scope of deliverables:

| File | Status |
|---|---|
| `src/utils/dealVerdict.ts` | **New** — pure `analyzeDeal` function + `DealVerdict` type |
| `src/components/ui/DealVerdictBadge.tsx` | **New** — React badge component |
| `src/pages/ProductDetailPage.tsx` | **Modified** — add badge to `OfferRow` |
| `src/pages/DealsPage.tsx` | **Modified** — add badge to `DealCard` |
| `tests/properties/dealVerdict.prop.ts` | **New** — fast-check property tests |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Client (browser)                                                │
│                                                                  │
│  usePriceHistory (existing hook)                                 │
│    └─ caches PriceStats per canonicalId::days::platform          │
│         │                                                        │
│         ▼                                                        │
│  analyzeDeal(currentPrice, platformOriginalPrice, stats, count)  │
│    └─ pure TS function, zero side-effects                        │
│         │                                                        │
│         ▼  DealVerdict | null                                    │
│  DealVerdictBadge (React component)                              │
│    ├─ ProductDetailPage → OfferRow                               │
│    └─ DealsPage → DealCard                                       │
└──────────────────────────────────────────────────────────────────┘
```

There is a deliberate one-way data flow:

1. **Data**: `usePriceHistory` fetches and caches `PriceStats` from the existing API.
2. **Logic**: `analyzeDeal` classifies the deal from raw numbers — no React, no I/O.
3. **Rendering**: `DealVerdictBadge` renders the result of `analyzeDeal`.

---

## Components and Interfaces

### `analyzeDeal` — Pure classification function

```ts
// src/utils/dealVerdict.ts

export type VerdictCode =
  | 'genuine'
  | 'inflated_mrp'
  | 'suspicious'
  | 'insufficient_data';

export interface DealVerdict {
  verdict: VerdictCode;
  badge:   string;   // short emoji + label, e.g. "🟢 Genuine Deal"
  detail:  string;   // longer contextual sentence
  saving:  number;   // platformOriginalPrice - currentPrice, floored at 0
}

export function analyzeDeal(
  currentPrice:           number,
  platformOriginalPrice:  number | undefined,
  stats:                  PriceStats,
  snapshotCount:          number,
): DealVerdict | null
```

`PriceStats` is imported directly from `usePriceHistory.ts` (already exported).

**Priority evaluation order** (first match wins):

| Priority | Condition | Verdict |
|---|---|---|
| 1 | `snapshotCount < 3` | `insufficient_data` |
| 2 | `currentPrice <= stats.lowestPrice × 1.05` | `genuine` |
| 3 | `platformOriginalPrice > stats.highestPrice × 1.5` | `inflated_mrp` |
| 4 | `currentPrice > stats.lowestPrice × 1.30` **and** `platformOriginalPrice` defined **and** `platformOriginalPrice > currentPrice` | `suspicious` |
| 5 | No match | `null` |

**Badge and detail strings per verdict:**

| Verdict | `badge` | `detail` |
|---|---|---|
| `genuine` | `🟢 Genuine Deal` | `Lowest price in 30 days` |
| `inflated_mrp` | `🔴 Suspicious Discount` | `Platform claims ₹{X} MRP, but highest recorded price was ₹{Y}` |
| `suspicious` | `⚠️ Price Increased Before Sale` | `Was cheaper — lowest recorded: ₹{X}` |
| `insufficient_data` | `⏳ Not Enough Data` | `Less than 3 price records available` |

**`saving` computation:**

```
saving = (platformOriginalPrice !== undefined && platformOriginalPrice > currentPrice)
         ? platformOriginalPrice - currentPrice
         : 0
```

`saving` is always `≥ 0`.

---

### `DealVerdictBadge` — React component

```ts
// src/components/ui/DealVerdictBadge.tsx

interface DealVerdictBadgeProps {
  verdict: DealVerdict | null;
}

export function DealVerdictBadge({ verdict }: DealVerdictBadgeProps): React.ReactElement | null
```

**Render rules:**

- `verdict === null` → returns `null` (no DOM output)
- `verdict.verdict === 'insufficient_data'` → returns `null`
- `verdict.verdict === 'genuine'` → green badge (Tailwind: `bg-emerald-50 text-emerald-700 border-emerald-100`)
- `verdict.verdict === 'inflated_mrp'` → red badge (Tailwind: `bg-red-50 text-red-700 border-red-100`)
- `verdict.verdict === 'suspicious'` → amber badge (Tailwind: `bg-amber-50 text-amber-700 border-amber-100`)

Accessibility: `aria-label={`${verdict.badge}: ${verdict.detail}`}` on the outermost element.

Tailwind classes only — no inline styles, no new CSS files.

---

### `OfferRow` integration in `ProductDetailPage`

`ProductDetailPage` already uses `usePriceHistory` (exported from `PriceHistoryPanel`). The integration adds one small step:

1. Lift `usePriceHistory` to the page level (it may already be used; if not, add it adjacent to the `PricePredictionBadge` call).
2. When `historyStatus === 'success'` and `stats !== null`, call `analyzeDeal` for each offer and pass the result to `OfferRow`.
3. `OfferRow` receives an optional `verdict?: DealVerdict | null` prop and renders `<DealVerdictBadge verdict={verdict} />` below the price line.
4. While `historyStatus !== 'success'`, no badge is shown (silent — no skeleton, no placeholder).

The price history fetch itself is already triggered lazily when the user expands the history panel. Badges for offer rows therefore appear as a side effect of loading price history — this is by design (Requirement 4.5).

**Snapshot count source:** `PriceHistoryPanel` currently receives `points` from `usePriceHistory`. `snapshotCount = points.length`. Pass this down alongside `stats`.

---

### `DealCard` integration in `DealsPage`

`DealsPage` renders deals from `GET /products/deals`. Each `Deal` object has a `_id` (MongoDB ObjectId, used as `canonicalId`). Stats are NOT currently loaded on this page.

The integration adds a **lazy, per-card stats fetch** using `usePriceHistory`:

1. Extract `DealCard` into a component that instantiates its own `usePriceHistory` hook.
2. On mount, call `hook.fetch(deal._id)` — the hook's internal cache ensures at most one network call per `_id`.
3. Render `<DealVerdictBadge verdict={...} />` once stats resolve. No badge skeleton.

Because `usePriceHistory` is already lazy and cache-aware, re-renders and list re-ordering don't cause duplicate fetches.

> **Note on the `Deal._id` / canonicalId mapping:** The `/products/deals` response already returns `_id` which is the MongoDB document `_id` and is the same identifier used by `/price-history/:canonicalId`. No mapping required.

---

### `ResultCard` integration in `SearchPage` (cache-only)

`SearchPage` uses `usePriceHistory` in a read-only, cache-only fashion:

1. After calling `analyzeDeal`, call a new exported helper `getVerdictFromCache(canonicalId, hookInstance)` — which reads `stats` from the hook's cache ref without triggering a fetch.
2. If the cache is cold, return `null` — no badge, no fetch.

This keeps `SearchPage` performance unchanged and satisfies Requirement 6.

---

## Data Models

No new Mongoose models or API response shapes are added.

The only new data shape is the `DealVerdict` type (pure TypeScript, client-side only):

```ts
export interface DealVerdict {
  verdict: 'genuine' | 'inflated_mrp' | 'suspicious' | 'insufficient_data';
  badge:   string;
  detail:  string;
  saving:  number;  // ≥ 0, in rupees
}
```

`PriceStats` (already in `usePriceHistory.ts`) is reused as-is:

```ts
export interface PriceStats {
  lowestPrice:  number;
  highestPrice: number;
  latestPrice:  number;
  firstSeen:    string;
  lastUpdated:  string;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Insufficient data always wins

*For any* valid combination of `currentPrice`, `platformOriginalPrice`, `stats`, and `snapshotCount` where `snapshotCount < 3`, `analyzeDeal` SHALL return a `DealVerdict` with `verdict === 'insufficient_data'` regardless of the price values.

**Validates: Requirements 1.2, 7.4**

---

### Property 2: Genuine deal classification

*For any* `stats` with `lowestPrice > 0`, `snapshotCount >= 3`, and `currentPrice` in the range `[1, stats.lowestPrice × 1.05]`, `analyzeDeal` SHALL return `verdict === 'genuine'`.

**Validates: Requirements 1.3, 7.2**

---

### Property 3: Inflated MRP classification (excluding genuine)

*For any* inputs where `snapshotCount >= 3`, `currentPrice > stats.lowestPrice × 1.05` (not genuine), and `platformOriginalPrice > stats.highestPrice × 1.5`, `analyzeDeal` SHALL return `verdict === 'inflated_mrp'`.

**Validates: Requirements 1.4, 7.3**

---

### Property 4: Suspicious classification (excluding genuine and inflated)

*For any* inputs where `snapshotCount >= 3`, `currentPrice > stats.lowestPrice × 1.05` (not genuine), `platformOriginalPrice <= stats.highestPrice × 1.5` (not inflated), `currentPrice > stats.lowestPrice × 1.30`, and `platformOriginalPrice > currentPrice`, `analyzeDeal` SHALL return `verdict === 'suspicious'`.

**Validates: Requirements 1.5**

---

### Property 5: Output verdict is always a valid value or null

*For any* arbitrary combination of inputs (including boundary values), `analyzeDeal` SHALL return either `null` or a `DealVerdict` whose `verdict` field is exactly one of `'genuine'`, `'inflated_mrp'`, `'suspicious'`, `'insufficient_data'`.

**Validates: Requirements 7.1**

---

### Property 6: Saving is always non-negative

*For any* inputs to `analyzeDeal` that produce a non-null `DealVerdict`, the `saving` field SHALL be `>= 0`.

**Validates: Requirements 1.8, 1.9, 7.5**

---

### Property 7: Saving matches the expected arithmetic

*For any* non-null `DealVerdict`, `saving` SHALL equal `max(0, platformOriginalPrice - currentPrice)` when `platformOriginalPrice` is defined and `> currentPrice`, and `0` otherwise.

**Validates: Requirements 1.8**

---

### Property 8: inflated_mrp detail string embeds the correct prices

*For any* inputs that produce `verdict === 'inflated_mrp'`, the `detail` string SHALL contain both `String(Math.round(platformOriginalPrice))` and `String(Math.round(stats.highestPrice))`.

**Validates: Requirements 2.3**

---

### Property 9: suspicious detail string embeds the correct lowest price

*For any* inputs that produce `verdict === 'suspicious'`, the `detail` string SHALL contain `String(Math.round(stats.lowestPrice))`.

**Validates: Requirements 2.4**

---

### Property 10: DealVerdictBadge aria-label combines badge and detail

*For any* `DealVerdict` with a visible verdict (`genuine`, `inflated_mrp`, `suspicious`), the rendered `DealVerdictBadge` SHALL have an `aria-label` that contains both `verdict.badge` and `verdict.detail`.

**Validates: Requirements 3.7**

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `stats` is `null` (history not loaded) | Caller passes `null` check before calling `analyzeDeal`; no badge rendered |
| `snapshotCount === 0` | `analyzeDeal` returns `insufficient_data` (covered by Property 1) |
| `platformOriginalPrice` is `undefined` | `saving` is `0`; `inflated_mrp` check is skipped; `suspicious` check is skipped |
| `currentPrice <= 0` or `stats.lowestPrice <= 0` | Thresholds evaluate to ≤ 0; `analyzeDeal` returns `null` gracefully |
| Network error fetching stats on `DealsPage` | `usePriceHistory` sets `status === 'error'`; badge simply stays hidden |
| `DealCard` unmounts before fetch completes | `usePriceHistory` guards against stale responses via `currentId.current` |

---

## Testing Strategy

### Unit tests (example-based)

- Verify `analyzeDeal` returns `null` when `stats` is invalid/zero
- Verify `DealVerdictBadge` returns `null` for `verdict === null` and `verdict.verdict === 'insufficient_data'`
- Verify badge colour classes for each visible verdict
- Verify `DealVerdictBadge` renders correct `badge` and `detail` text

### Property-based tests (`tests/properties/dealVerdict.prop.ts`)

Using **fast-check** (already installed — see `tests/properties/search.prop.ts`).

Each property test runs a minimum of **100 iterations** per `fc.assert` call.

Each test is tagged with a comment in the format:
`// Feature: fake-discount-detector, Property N: <property text>`

Properties to implement as property tests:

| Property | fast-check strategy |
|---|---|
| P1 — Insufficient data always wins | `fc.record({ snapshotCount: fc.integer({min:0, max:2}), ... })` |
| P2 — Genuine deal classification | Constrain `currentPrice ≤ lowestPrice × 1.05` |
| P3 — Inflated MRP classification | Constrain `currentPrice > lowestPrice × 1.05`, `origPrice > highestPrice × 1.5` |
| P4 — Suspicious classification | Constrain all three exclusion + inclusion conditions |
| P5 — Output is always valid or null | Fully unconstrained arbitrary inputs |
| P6 — Saving ≥ 0 | Any non-null output; assert `saving >= 0` |
| P7 — Saving arithmetic | Derive expected saving, compare with returned value |
| P8 — inflated_mrp detail string | Filter outputs to inflated_mrp, check substring presence |
| P9 — suspicious detail string | Filter outputs to suspicious, check substring presence |
| P10 — aria-label correctness | Generate DealVerdict, render badge, check aria-label |

### Integration tests (not property-based)

- `ProductDetailPage`: mount with mocked `usePriceHistory` returning known stats; verify badge appears inside `OfferRow` when stats are loaded and disappears when `status !== 'success'`
- `DealsPage`: mount with mocked `usePriceHistory`; verify badge lifecycle (hidden → shown after stats resolve)
- `SearchPage`: verify no extra `fetch` calls are triggered; verify badge shown only when cache is populated
