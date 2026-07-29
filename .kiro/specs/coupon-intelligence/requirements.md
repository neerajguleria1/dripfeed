# Requirements Document

## Introduction

Coupon Intelligence is a new layer for DripFeed (TagCheck India) that surfaces the best applicable coupon codes per platform on every screen of the app — Homepage, Search, Deals, Product Detail, and Compare pages. Users see not just the listed price but the **effective price** after the best available coupon is applied, and can one-tap copy the code before clicking through to buy. A curated coupon database is maintained by admin and served to the frontend via a public API with client-side caching.

The feature has no browser-extension dependency; it is entirely in-app and web-first. Effective price calculation is deterministic and testable as a pure function, making it a strong candidate for property-based testing with fast-check + vitest.

---

## Glossary

- **Coupon**: A record in the Coupon collection representing a discount code for a specific platform. Contains code, discount type, discount value, constraints, and lifecycle metadata.
- **Coupon_Engine**: The pure TypeScript module (`src/utils/couponEngine.ts`) responsible for applying coupons to a listed price and selecting the best coupon.
- **Effective_Price**: The final price a user would pay after the best applicable coupon for a platform is applied to the listed price. Always a non-negative integer (floor to nearest rupee).
- **Listed_Price**: The price shown on a platform before any coupon is applied. Sourced from the existing platform listing data.
- **Platform**: One of the five supported Indian e-commerce platforms: Myntra, Ajio, Amazon, Flipkart, Meesho.
- **Discount_Type**: The mechanism of a coupon's discount. One of: `percent` (percentage off listed price), `flat` (fixed rupee deduction), `bank_offer` (flat deduction contingent on payment method — treated as flat for calculation purposes), `cashback` (post-purchase rebate shown as an advisory badge, not deducted from effective price).
- **Min_Order_Value**: The minimum listed price required for a coupon to be applicable.
- **Max_Discount_Cap**: The maximum rupee amount a percent coupon can deduct (optional). If set, the deduction is `min(listed_price * discount / 100, max_discount_cap)`.
- **Valid_Until**: The UTC datetime after which a coupon is considered expired and must not be surfaced.
- **Success_Rate**: A float in [0, 1] representing the observed rate at which this coupon code has been reported working. Used for display purposes and tie-breaking only.
- **CouponBadge**: The UI component that displays the best coupon for a platform inline on product/offer rows — shows the saving amount, code, and a copy button.
- **Admin**: A user with `role === 'admin'` in the existing User model, authenticated via the existing JWT mechanism.
- **Coupon_API**: The new Express handler at `api/_lib/handlers/coupons.ts`, registered in the catch-all router.
- **Coupon_Cache**: A client-side in-memory cache (with a 15-minute TTL) that stores all active coupons fetched from the Coupon_API, keyed by platform, to avoid per-render API calls.

---

## Requirements

### Requirement 1: Coupon Data Model

**User Story:** As an Admin, I want a structured coupon record per platform so that I can maintain an accurate, queryable database of active coupon codes.

#### Acceptance Criteria

1. THE Coupon_API SHALL store each coupon with the following fields: `platform` (string, one of the five supported Platform values), `code` (string, the coupon code), `discountType` (one of: `percent`, `flat`, `bank_offer`, `cashback`), `discountValue` (positive number), `minOrderValue` (non-negative number, defaults to 0), `maxDiscountCap` (optional positive number), `validUntil` (Date), `categories` (optional array of strings for category filtering), `verifiedAt` (Date), `successRate` (float in [0, 1], defaults to 0.5), `isActive` (boolean, defaults to true), `description` (optional string for admin notes).
2. THE Coupon_API SHALL enforce that `platform` is one of: `myntra`, `ajio`, `amazon`, `flipkart`, `meesho` (case-insensitive storage as lowercase).
3. THE Coupon_API SHALL enforce that `discountValue` is a positive finite number.
4. THE Coupon_API SHALL enforce that `minOrderValue` is a non-negative finite number.
5. WHEN `maxDiscountCap` is provided, THE Coupon_API SHALL enforce that it is a positive finite number greater than zero.
6. THE Coupon_API SHALL store `validUntil` as a UTC Date and index it for efficient expiry filtering.
7. THE Coupon_API SHALL index the `platform` field and the `isActive` field for efficient querying by the public endpoint.

---

### Requirement 2: Public Coupons API Endpoint

**User Story:** As a frontend user, I want the app to fetch all active coupons at once so that effective prices can be computed client-side without a per-product API call.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/coupons`, THE Coupon_API SHALL return all coupons where `isActive` is true AND `validUntil` is greater than the current UTC time.
2. THE Coupon_API SHALL respond to GET `/api/coupons` with a JSON body of shape `{ coupons: Coupon[], fetchedAt: string (ISO-8601) }`.
3. THE Coupon_API SHALL filter the response to only include the fields required by the frontend: `_id`, `platform`, `code`, `discountType`, `discountValue`, `minOrderValue`, `maxDiscountCap`, `categories`, `validUntil`, `successRate`, `description`.
4. THE Coupon_API SHALL set `Cache-Control: public, max-age=900` on the GET `/api/coupons` response to enable CDN edge caching for 15 minutes.
5. IF the MongoDB query fails, THEN THE Coupon_API SHALL return HTTP 500 with `{ error: 'Failed to fetch coupons' }`.
6. THE Coupon_API SHALL support an optional `platform` query parameter to return coupons for a single platform only (e.g., `GET /api/coupons?platform=myntra`).

---

### Requirement 3: Admin Coupon Management API

**User Story:** As an Admin, I want to create, update, and deactivate coupons via the AdminPage so that the coupon database stays current and incorrect codes can be removed quickly.

#### Acceptance Criteria

1. WHEN an authenticated Admin sends a POST request to `/api/coupons` with valid coupon fields, THE Coupon_API SHALL create a new coupon document and return HTTP 201 with the created coupon.
2. WHEN an authenticated Admin sends a PATCH request to `/api/coupons/:id` with one or more updatable fields, THE Coupon_API SHALL update only the specified fields and return the updated coupon.
3. WHEN an authenticated Admin sends a DELETE request to `/api/coupons/:id`, THE Coupon_API SHALL set `isActive` to false (soft delete) and return HTTP 200 with `{ ok: true }`.
4. IF a POST or PATCH request is made without valid Admin authentication, THEN THE Coupon_API SHALL return HTTP 401.
5. IF a POST request body is missing required fields (`platform`, `code`, `discountType`, `discountValue`, `validUntil`), THEN THE Coupon_API SHALL return HTTP 400 with a descriptive error message identifying the missing field.
6. IF a PATCH or DELETE request targets a coupon `_id` that does not exist, THEN THE Coupon_API SHALL return HTTP 404.
7. WHEN an authenticated Admin sends a GET request to `/api/coupons/admin`, THE Coupon_API SHALL return ALL coupons (including inactive and expired) for management purposes, with pagination support via `?page=` and `?limit=` query parameters (default limit 50).

---

### Requirement 4: Effective Price Calculation (Coupon Engine)

**User Story:** As a user, I want to see the true lowest price after applying the best coupon so that I can make a confident buying decision without manual calculation.

#### Acceptance Criteria

1. THE Coupon_Engine SHALL accept a `listedPrice` (positive integer, in rupees) and an array of `Coupon` objects for the same platform, and return an object containing: `effectivePrice` (integer, ≥ 0), `saving` (integer, ≥ 0), `bestCoupon` (the Coupon object that produced the lowest effective price, or null if no coupon applies).
2. WHEN the discount type is `percent`, THE Coupon_Engine SHALL compute effective price as `Math.floor(listedPrice * (1 - discountValue / 100))`, subject to `maxDiscountCap` if set: deduction = `Math.min(Math.floor(listedPrice * discountValue / 100), maxDiscountCap)`, effective price = `listedPrice - deduction`.
3. WHEN the discount type is `flat` or `bank_offer`, THE Coupon_Engine SHALL compute effective price as `Math.max(listedPrice - discountValue, 0)`.
4. WHEN the discount type is `cashback`, THE Coupon_Engine SHALL NOT deduct any amount from the effective price; the effective price equals the listed price. The coupon is still surfaced as an advisory badge.
5. WHEN a coupon's `minOrderValue` exceeds the `listedPrice`, THE Coupon_Engine SHALL NOT apply that coupon.
6. WHEN the `validUntil` date of a coupon is before the current time, THE Coupon_Engine SHALL NOT apply that coupon.
7. THE Coupon_Engine SHALL select the coupon that produces the lowest effective price as the best coupon; in case of a tie, the coupon with the higher `successRate` SHALL be preferred.
8. THE Coupon_Engine SHALL return `effectivePrice` equal to `listedPrice` and `bestCoupon` equal to null when no applicable coupon exists for the platform.
9. THE Coupon_Engine SHALL always return `effectivePrice` that is less than or equal to `listedPrice` (coupons never increase price).
10. THE Coupon_Engine SHALL always return `effectivePrice` that is greater than or equal to zero.

---

### Requirement 5: Client-Side Coupon Cache

**User Story:** As a user, I want coupon data to be available instantly on every page without noticeable loading delay so that the shopping experience feels seamless.

#### Acceptance Criteria

1. THE Coupon_Cache SHALL fetch all active coupons from `/api/coupons` once on first use and store the result in module-level memory.
2. THE Coupon_Cache SHALL treat its cached data as stale after 15 minutes from `fetchedAt` and refetch on next access after the TTL expires.
3. WHEN a component requests coupons for a platform, THE Coupon_Cache SHALL return from the in-memory store if the cache is still fresh, without making a network request.
4. IF the `/api/coupons` fetch fails, THEN THE Coupon_Cache SHALL return an empty array for all platforms and retry on the next component mount.
5. THE Coupon_Cache SHALL expose a hook `useCoupons(platform: string)` that returns `{ coupons: Coupon[], loading: boolean }`, where `loading` is true only while an active network request is in flight.

---

### Requirement 6: CouponBadge UI Component

**User Story:** As a user, I want to see a "Save extra ₹X with code ABC" badge on each platform's offer row so that I know exactly how much extra I can save and what code to use.

#### Acceptance Criteria

1. THE CouponBadge SHALL display the saving amount (e.g., "Save ₹150") and the coupon code (e.g., "SAVE150") on a single line within the offer row for a platform.
2. THE CouponBadge SHALL include a one-tap copy button that copies the coupon code to the clipboard.
3. WHEN the copy button is tapped, THE CouponBadge SHALL replace the copy icon with a checkmark for 2 seconds, then revert, providing visual confirmation.
4. WHEN the discount type is `cashback`, THE CouponBadge SHALL display a "₹X cashback" advisory label without showing an effective price deduction.
5. WHEN no applicable coupon exists for a platform, THE CouponBadge SHALL NOT be rendered for that platform's row.
6. THE CouponBadge SHALL meet WCAG 2.1 AA colour contrast requirements and include an accessible `aria-label` on the copy button (e.g., "Copy coupon code SAVE150").
7. WHEN the coupon has a `description`, THE CouponBadge SHALL display it as a tooltip or sub-line (e.g., "On HDFC cards").

---

### Requirement 7: Effective Price Display on Product Detail Page

**User Story:** As a user comparing prices on the Product Detail Page, I want to see the effective price after coupon alongside the listed price for each platform's offer row so that I can identify the genuinely cheapest option.

#### Acceptance Criteria

1. WHEN a platform offer has an applicable active coupon, THE OfferRow component SHALL display the effective price in a prominent colour (e.g., emerald) and the listed price struck through.
2. THE OfferRow component SHALL render the CouponBadge below the price area for any platform offer that has an applicable coupon.
3. WHEN computing "Best Deal" ranking on the Product Detail Page, THE ProductDetailPage SHALL sort offer rows by effective price (not listed price) so that the offer with the best post-coupon price appears first.
4. WHEN no coupons are available or the Coupon_Cache is loading, THE ProductDetailPage SHALL display listed prices only, without any layout shift.

---

### Requirement 8: Effective Price Display on Compare Page

**User Story:** As a user on the Compare Page, I want each platform comparison block to show the effective price after coupon so that the "Best Value" recommendation reflects the true cheapest option.

#### Acceptance Criteria

1. WHEN a platform comparison block has an applicable coupon, THE ComparePage SHALL display the effective price prominently and the listed price struck through within that block.
2. WHEN a platform comparison block has an applicable coupon, THE ComparePage SHALL render the CouponBadge within that block; WHEN no coupon is applicable for a platform, THE ComparePage SHALL NOT render a CouponBadge for that block.
3. THE ComparePage SHALL determine the "Best Value" platform based on effective price, not listed price.
4. WHEN no coupons apply to any platform, THE ComparePage SHALL display listed prices only, with no visible coupon UI elements.

---

### Requirement 9: Effective Price Display on Deals Page

**User Story:** As a user browsing the Deals Page, I want each deal card to show the effective price after coupon and the coupon code so that I can immediately see the true saving.

#### Acceptance Criteria

1. WHEN a deal card's platform has an applicable active coupon AND the deal's listed price meets the coupon's `minOrderValue`, THE DealCard component SHALL display the effective price instead of (or alongside) the listed price.
2. THE DealCard component SHALL render a compact CouponBadge (code + saving, no copy button redundancy) below the price block on cards where a coupon applies.
3. WHEN no coupon applies to the deal's platform for that price, THE DealCard component SHALL display the listed price unchanged.

---

### Requirement 10: Effective Price Display on Homepage Deals Section

**User Story:** As a user browsing the Homepage deals grid, I want deal cards to reflect the effective price after coupon so that I see the most accurate savings from the first touch.

#### Acceptance Criteria

1. WHEN a homepage deal card's platform has an applicable active coupon AND the deal's price meets the coupon's `minOrderValue`, THE HomePage deals grid SHALL display the effective price rather than the listed price.
2. THE HomePage deals grid SHALL show a compact coupon indicator label (e.g., "+coupon" pill) on cards where a coupon reduces the price, without cluttering the card layout.
3. WHEN no coupon is applicable, THE HomePage SHALL display the deal card's listed price unchanged.

---

### Requirement 11: Admin Coupon Management UI

**User Story:** As an Admin, I want a dedicated "Coupons" tab on the AdminPage so that I can add, edit, and deactivate coupon codes without needing a separate tool.

#### Acceptance Criteria

1. THE AdminPage SHALL include a "Coupons" tab that lists all coupons (active and inactive) fetched from `GET /api/coupons/admin`.
2. WHEN the Admin clicks "Add Coupon", THE AdminPage SHALL display an inline form with fields for all required and optional coupon attributes.
3. WHEN the Admin submits a valid "Add Coupon" form, THE AdminPage SHALL call `POST /api/coupons` and display the new coupon in the list on success.
4. WHEN the Admin clicks "Edit" on an existing coupon, THE AdminPage SHALL populate an inline edit form with the coupon's current values.
5. WHEN the Admin submits a valid edit form, THE AdminPage SHALL call `PATCH /api/coupons/:id` and update the coupon in the list on success.
6. WHEN the Admin clicks "Deactivate" on an active coupon, THE AdminPage SHALL call `DELETE /api/coupons/:id` (soft delete) and update the coupon's displayed status to inactive.
7. THE AdminPage coupons tab SHALL display each coupon's platform, code, discount type and value, valid-until date, success rate, and active status in a readable table or card layout.
8. IF a form submission returns an error from the Coupon_API, THEN THE AdminPage SHALL display the error message inline without losing the form's current values.

---

### Requirement 12: Correctness Properties (Property-Based Tests)

**User Story:** As a developer, I want automated property-based tests for the Coupon Engine so that discount calculation regressions are caught immediately without manual test cases for every edge.

#### Acceptance Criteria

1. FOR ALL valid `listedPrice` values (positive integers) and applicable `percent` coupons, THE Coupon_Engine's effective price SHALL equal `listedPrice - Math.min(Math.floor(listedPrice * discountValue / 100), maxDiscountCap ?? Infinity)`.
2. FOR ALL valid `listedPrice` values and applicable `flat` or `bank_offer` coupons, THE Coupon_Engine's effective price SHALL equal `Math.max(listedPrice - discountValue, 0)`.
3. FOR ALL inputs, THE Coupon_Engine's effective price SHALL always be less than or equal to `listedPrice` (a coupon never increases the price).
4. FOR ALL inputs, THE Coupon_Engine's effective price SHALL always be greater than or equal to zero.
5. FOR ALL coupons where `minOrderValue` exceeds `listedPrice`, THE Coupon_Engine SHALL NOT apply the coupon and the effective price SHALL equal `listedPrice`.
6. FOR ALL coupons where `validUntil` is before the current timestamp, THE Coupon_Engine SHALL NOT apply the coupon and the effective price SHALL equal `listedPrice`.
7. FOR ALL platform coupon arrays, THE Coupon_Engine's selected best coupon SHALL be the one that produces the minimum effective price among all applicable coupons.
