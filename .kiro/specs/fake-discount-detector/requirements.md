# Requirements Document

## Introduction

Indian e-commerce platforms (Myntra, Ajio, Flipkart, Amazon, Meesho) routinely inflate their listed MRP so that discounts appear larger than they actually are. TagCheck (DripFeed) already stores 90 days of real price history per product per platform. This feature exposes fake discounts by analysing that history and surfacing a **Deal Verdict Badge** wherever a product's price is shown — on `ProductDetailPage` (per-platform offer rows), `DealsPage` (deal cards), and optionally `SearchPage` (result cards when stats are already cached).

The core of the feature is a pure client-side function, `analyzeDeal`, that classifies a deal into one of four verdict states and returns a displayable badge + detail string. No additional API calls are made; the badge reuses `PriceStats` data that is already fetched when the price history panel loads.

---

## Glossary

- **DealVerdict_Engine**: The pure TypeScript module that exports `analyzeDeal` and the `DealVerdict` type.
- **DealVerdict_Badge**: The React component that renders a coloured badge (or nothing) based on a `DealVerdict` value.
- **PriceStats**: The object shape `{ lowestPrice, highestPrice, latestPrice, firstSeen, lastUpdated }` returned by `getPriceStats()` and already available in `usePriceHistory`.
- **SnapshotCount**: The number of price data points recorded for a product within the 90-day retention window. Determines data sufficiency.
- **currentPrice**: The price currently shown by a platform for a specific product offer.
- **platformOriginalPrice**: The MRP or "original price" claimed by the platform (the crossed-out price displayed beside the selling price).
- **historical_lowestPrice**: `PriceStats.lowestPrice` — the lowest price ever recorded by TagCheck for this product.
- **historical_highestPrice**: `PriceStats.highestPrice` — the highest price ever recorded by TagCheck for this product.
- **Genuine_Threshold**: `currentPrice <= historical_lowestPrice × 1.05` — within 5 % of all-time low.
- **InflatedMRP_Threshold**: `platformOriginalPrice > historical_highestPrice × 1.5` — claimed MRP is more than 50 % above the highest price ever seen.
- **Suspicious_Threshold**: `currentPrice > historical_lowestPrice × 1.30` — current price is more than 30 % above the historical low while the platform simultaneously claims a large discount.
- **Minimum_Snapshot_Count**: 3 — the minimum number of historical snapshots required before any verdict other than `insufficient_data` is returned.
- **ProductDetailPage**: The existing `/product/:canonicalId` page that displays per-platform `OfferRow` components and already loads `PriceStats` via `usePriceHistory` when the user expands the Price History panel.
- **DealsPage**: The existing `/deals` page showing `DealCard` components for top price drops.
- **SearchPage**: The existing `/search` page showing `ResultCard` and `FeaturedCard` components.
- **OfferRow**: A single platform offer row inside `ProductDetailPage`.
- **DealCard**: A deal card inside `DealsPage`.
- **ResultCard**: A product card inside `SearchPage`.

---

## Requirements

### Requirement 1: Deal Verdict Engine — Core Classification

**User Story:** As a TagCheck user, I want to see whether a displayed discount is genuine or inflated based on real price history, so that I can make an informed buying decision without being deceived by artificially high MRPs.

#### Acceptance Criteria

1. THE DealVerdict_Engine SHALL export a pure function `analyzeDeal(currentPrice: number, platformOriginalPrice: number | undefined, stats: PriceStats, snapshotCount: number): DealVerdict`.
2. WHEN `snapshotCount` is fewer than 3, THE DealVerdict_Engine SHALL return a `DealVerdict` with `verdict` equal to `'insufficient_data'` regardless of any price values.
3. WHEN `snapshotCount` is 3 or more AND `currentPrice` is at or below `stats.lowestPrice × 1.05`, THE DealVerdict_Engine SHALL return a `DealVerdict` with `verdict` equal to `'genuine'`.
4. WHEN `snapshotCount` is 3 or more AND `platformOriginalPrice` is greater than `stats.highestPrice × 1.5`, THE DealVerdict_Engine SHALL return a `DealVerdict` with `verdict` equal to `'inflated_mrp'`.
5. WHEN `snapshotCount` is 3 or more AND `currentPrice` is greater than `stats.lowestPrice × 1.30`, AND `platformOriginalPrice` is defined and greater than `currentPrice`, THE DealVerdict_Engine SHALL return a `DealVerdict` with `verdict` equal to `'suspicious'`.
6. WHEN no verdict condition from criteria 2–5 is met, THE DealVerdict_Engine SHALL return `null` to indicate no badge should be shown.
7. THE DealVerdict_Engine SHALL evaluate verdict conditions in priority order: `insufficient_data` first, then `genuine`, then `inflated_mrp`, then `suspicious`.
8. THE DealVerdict_Engine SHALL set `DealVerdict.saving` to `platformOriginalPrice - currentPrice` when `platformOriginalPrice` is defined and greater than `currentPrice`, and to `0` otherwise.
9. THE DealVerdict_Engine SHALL set `DealVerdict.saving` to a value that is never negative.

---

### Requirement 2: DealVerdict Type Contract

**User Story:** As a developer integrating the Deal Verdict Badge, I want a well-typed `DealVerdict` object, so that I can render the correct badge without writing conditional logic in UI components.

#### Acceptance Criteria

1. THE DealVerdict_Engine SHALL export a TypeScript type `DealVerdict` with the shape `{ verdict: 'genuine' | 'suspicious' | 'inflated_mrp' | 'insufficient_data'; badge: string; detail: string; saving: number }`.
2. WHEN `verdict` is `'genuine'`, THE DealVerdict_Engine SHALL set `badge` to `'🟢 Genuine Deal'` and `detail` to `'Lowest price in 30 days'`.
3. WHEN `verdict` is `'inflated_mrp'`, THE DealVerdict_Engine SHALL set `badge` to `'🔴 Suspicious Discount'` and `detail` to a string of the form `'Platform claims ₹X MRP, but highest recorded price was ₹Y'` where X is `platformOriginalPrice` and Y is `stats.highestPrice`.
4. WHEN `verdict` is `'suspicious'`, THE DealVerdict_Engine SHALL set `badge` to `'⚠️ Price Increased Before Sale'` and `detail` to a string of the form `'Was cheaper — lowest recorded: ₹X'` where X is `stats.lowestPrice`.
5. WHEN `verdict` is `'insufficient_data'`, THE DealVerdict_Engine SHALL set `badge` to `'⏳ Not Enough Data'` and `detail` to `'Less than 3 price records available'`.

---

### Requirement 3: Deal Verdict Badge Component

**User Story:** As a TagCheck user, I want to see a clearly coloured badge on every product and deal card, so that I can instantly understand whether a discount is real without reading the detailed price history.

#### Acceptance Criteria

1. THE DealVerdict_Badge SHALL accept a `verdict` prop of type `DealVerdict | null`.
2. WHEN `verdict` is `null`, THE DealVerdict_Badge SHALL render nothing (no DOM output).
3. WHEN `verdict.verdict` is `'insufficient_data'`, THE DealVerdict_Badge SHALL render nothing.
4. WHEN `verdict.verdict` is `'genuine'`, THE DealVerdict_Badge SHALL render a green-styled badge displaying `verdict.badge` and `verdict.detail`.
5. WHEN `verdict.verdict` is `'inflated_mrp'`, THE DealVerdict_Badge SHALL render a red-styled badge displaying `verdict.badge` and `verdict.detail`.
6. WHEN `verdict.verdict` is `'suspicious'`, THE DealVerdict_Badge SHALL render an amber-styled badge displaying `verdict.badge` and `verdict.detail`.
7. THE DealVerdict_Badge SHALL be accessible with a descriptive `aria-label` combining `verdict.badge` and `verdict.detail`.
8. THE DealVerdict_Badge SHALL use only Tailwind CSS classes consistent with the existing TagCheck design system (no inline styles, no new CSS files).

---

### Requirement 4: Integration on ProductDetailPage — OfferRow

**User Story:** As a TagCheck user viewing a product's platform offers, I want to see a verdict badge below the price of each offer row, so that I know which platform's discount is real and which is inflated.

#### Acceptance Criteria

1. WHEN the Price History panel is expanded on `ProductDetailPage` and `PriceStats` is successfully loaded, THE ProductDetailPage SHALL pass `stats` and `snapshotCount` to `analyzeDeal` for each `OfferRow`, using the offer's `price` as `currentPrice` and `originalPrice` as `platformOriginalPrice`.
2. WHEN `analyzeDeal` returns a non-null `DealVerdict` with `verdict` not equal to `'insufficient_data'`, THE OfferRow SHALL render a `DealVerdict_Badge` below the price area of that offer row.
3. WHEN `analyzeDeal` returns `null` or a `DealVerdict` with `verdict` equal to `'insufficient_data'`, THE OfferRow SHALL render no badge.
4. THE ProductDetailPage SHALL NOT make any additional API calls to display the Deal Verdict Badge — it SHALL reuse `PriceStats` already fetched by `usePriceHistory`.
5. WHILE the Price History panel is collapsed or `PriceStats` has not yet loaded, THE OfferRow SHALL render no badge.

---

### Requirement 5: Integration on DealsPage — DealCard

**User Story:** As a TagCheck user browsing the Deals page, I want each deal card to show a verdict badge below the discount percentage, so that I can distinguish genuine price drops from artificially inflated discounts at a glance.

#### Acceptance Criteria

1. WHEN `DealsPage` renders a `DealCard` and `PriceStats` for the deal's canonical product is available, THE DealCard SHALL display a `DealVerdict_Badge` below the discount percentage area.
2. WHEN `analyzeDeal` returns `null` or `verdict` equal to `'insufficient_data'` for a deal, THE DealCard SHALL display no badge for that deal.
3. THE DealsPage SHALL load `PriceStats` for visible deals using the existing `usePriceHistory` hook without triggering more than one API call per unique `canonicalId`.
4. THE DealCard SHALL NOT make blocking API calls that delay the initial render of the deals grid — stats SHALL be fetched asynchronously and the badge SHALL appear after stats resolve.
5. WHEN `PriceStats` is loading for a deal, THE DealCard SHALL render no badge placeholder (silent loading, no skeleton for the badge itself).

---

### Requirement 6: Integration on SearchPage — ResultCard (Cache-Only)

**User Story:** As a TagCheck user searching for products, I want to see verdict badges on result cards when history data is already cached, so that I get extra context without slowing down the search experience.

#### Acceptance Criteria

1. WHEN a `ResultCard` on `SearchPage` has `PriceStats` available in the `usePriceHistory` cache for its `canonicalId`, THE ResultCard SHALL display a `DealVerdict_Badge` on the price line.
2. WHEN `PriceStats` for a `ResultCard` is not cached, THE ResultCard SHALL display no badge and SHALL NOT fetch price history — no new API calls are made from `SearchPage` cards.
3. THE SearchPage SHALL NOT degrade search result load time due to the Deal Verdict Badge — all badge computation is synchronous and client-side only.

---

### Requirement 7: Property-Based Correctness of analyzeDeal

**User Story:** As a developer maintaining the Deal Verdict Engine, I want property-based tests to prove the classification logic is correct under all possible input combinations, so that I can confidently refactor thresholds or add new verdicts without regressions.

#### Acceptance Criteria

1. FOR ALL valid inputs, THE DealVerdict_Engine SHALL return a `verdict` value that is one of `'genuine'`, `'suspicious'`, `'inflated_mrp'`, `'insufficient_data'`, or `null` (from the outer function).
2. FOR ALL inputs where `currentPrice > stats.lowestPrice × 1.05`, THE DealVerdict_Engine SHALL NEVER return `verdict` equal to `'genuine'`.
3. FOR ALL inputs where `platformOriginalPrice <= stats.highestPrice × 1.5`, THE DealVerdict_Engine SHALL NEVER return `verdict` equal to `'inflated_mrp'`.
4. FOR ALL inputs where `snapshotCount < 3`, THE DealVerdict_Engine SHALL ALWAYS return `verdict` equal to `'insufficient_data'`.
5. FOR ALL valid inputs, `DealVerdict.saving` SHALL be greater than or equal to `0`.
6. THE DealVerdict_Engine property tests SHALL be implemented using `fast-check` in a file at `tests/properties/dealVerdict.prop.ts`, consistent with the existing property test structure in the project.
