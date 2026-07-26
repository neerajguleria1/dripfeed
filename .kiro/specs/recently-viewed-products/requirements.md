# Requirements Document

## Introduction

The **Recently Viewed Products** feature gives TagCheck India users a personalised browsing trail. When a visitor opens a product detail page, the system records that view. The history is shown as a horizontal scroll section on the **Homepage** (after "Today's biggest drops") and as a compact section on the **Product Detail Page** (before the ASCI disclosure). Anonymous visitors are supported via `localStorage`; authenticated users get durable, server-side persistence with automatic post-login merge of any anonymous history.

The core logic (`useRecentlyViewed` hook, `RecentlyViewedSection` component, and the backend endpoints) is **already implemented**. The remaining work is wiring the section into `HomePage.tsx`, rendering it in `ProductDetailPage.tsx`, connecting `syncAfterLogin` to `AuthContext`, and writing the test suite.

---

## Glossary

- **Tracker**: The `useRecentlyViewed` hook — owns all read/write logic for the recently viewed list.
- **RecentItem**: A `ProductData` object extended with `id` (canonicalId) and `viewedAt` (Unix ms timestamp).
- **CanonicalId**: The platform-agnostic product identifier used as the deduplication key.
- **LocalStorage_Cache**: The browser `localStorage` entry keyed `tc_recently_viewed`, used as the optimistic cache for all users.
- **History**: The ordered list of `RecentItem` objects maintained by the Tracker. Always sorted most-recent first.
- **MAX_RECENT**: The maximum number of items the History may contain. Default `20`. Configurable via `RECENT_PRODUCTS_MAX` env var on the backend.
- **TTL_MS**: The time-to-live for a History entry in milliseconds. Default `30 days`. Configurable via `RECENT_PRODUCTS_TTL_MS` env var on the backend. Frontend uses matching constant `30 * 24 * 60 * 60 * 1000`.
- **Cutoff**: The timestamp `Date.now() - TTL_MS`. Items with `viewedAt < Cutoff` are considered expired.
- **upsertFront**: The pure deduplication function — removes any existing entry for the same CanonicalId, prepends the new entry, then trims to MAX_RECENT.
- **RecentlyViewedSection**: The `src/components/product/RecentlyViewedSection.tsx` component that renders the History as a scrollable card list.
- **ProductCard**: The canonical card component at `src/components/product/ProductCard.tsx`, reused by RecentlyViewedSection.
- **ProductDetailPage**: The page at `/product/:canonicalId` (`src/pages/ProductDetailPage.tsx`).
- **HomePage**: The root page (`src/pages/HomePage.tsx`).
- **AuthContext**: The React context at `src/context/AuthContext.tsx` that owns `onLoginSuccess` / `setOnLoginSuccess`.
- **Backend_Endpoint_GET**: `GET /api/users/recent-products`.
- **Backend_Endpoint_POST**: `POST /api/users/recent-products`.
- **UserPreferences**: The MongoDB document (`api/_lib/models/UserPreferences.ts`) that embeds the `recentProducts` array.
- **syncAfterLogin**: The async function returned by the Tracker that merges the anonymous LocalStorage_Cache into the backend after a successful login.

---

## Requirements

### Requirement 1: Track Product Views on the Product Detail Page

**User Story:** As a visitor, I want my product page visits to be automatically recorded, so that I can revisit recently browsed items without searching again.

#### Acceptance Criteria

1. WHEN a ProductDetailPage loads successfully (status `'success'`) and the product data is available, THE Tracker SHALL call `trackView` with the product's CanonicalId, title, brand, best offer image URL, best offer price, original price, discount, platform, and affiliate URL.
2. WHEN `trackView` is called, THE Tracker SHALL update the in-memory History via upsertFront synchronously in the same render cycle, before any async operation (network call or localStorage write) begins.
3. WHEN `trackView` is called, THE Tracker SHALL persist the updated History to the LocalStorage_Cache synchronously in the same render cycle, before any async operation begins.
4. WHEN a product with an undefined, null, or whitespace-only CanonicalId is passed to `trackView`, THE Tracker SHALL return without modification, and the in-memory History and LocalStorage_Cache SHALL remain unchanged.
5. WHEN the user is authenticated and `trackView` is called, THE Tracker SHALL fire a POST to Backend_Endpoint_POST as a fire-and-forget operation with the product fields required by the endpoint; the UI update SHALL NOT be deferred pending this call.
6. WHEN the user is not authenticated and `trackView` is called, THE Tracker SHALL NOT make any network request; all state changes SHALL be confined to in-memory and LocalStorage_Cache.
7. IF the Backend_Endpoint_POST call fails for any reason, THEN the in-memory History and LocalStorage_Cache SHALL remain as set by the synchronous update in criterion 2, and no error SHALL be surfaced to the user.

---

### Requirement 2: Anonymous User — localStorage-Only History

**User Story:** As an anonymous visitor, I want my recently viewed products saved locally, so that my browsing history persists across page refreshes without requiring an account.

#### Acceptance Criteria

1. WHEN the Tracker initialises and `isLoggedIn` is `false`, THE Tracker SHALL read the initial History state exclusively from the LocalStorage_Cache by parsing the JSON value at key `tc_recently_viewed`.
2. WHEN the LocalStorage_Cache is read and parsed successfully, THE Tracker SHALL discard any entry whose `viewedAt` timestamp is strictly less than `Date.now() - TTL_MS` (i.e., older than TTL_MS milliseconds ago).
3. WHEN a product view event occurs and the Tracker writes to the LocalStorage_Cache, THE Tracker SHALL serialise only the first MAX_RECENT items of the updated History, ordered most-recent first, retaining the items with the most recent `viewedAt` values when trimming is required.
4. IF the `localStorage.setItem` call throws any exception (including `QuotaExceededError`), THEN THE Tracker SHALL silently catch the error; the in-memory History state SHALL remain as set by criterion 2 or 3 of Requirement 1.
5. IF the `localStorage.getItem` call throws any exception or returns malformed JSON that cannot be parsed, THEN THE Tracker SHALL treat the initial History as an empty array and continue without surfacing an error.
6. WHEN `isLoggedIn` transitions from `true` to `false` (user logout), THE Tracker SHALL set `hasFetched` to `false` (the server-fetch flag) and re-read the History from the LocalStorage_Cache, applying TTL filtering as in criterion 2.
7. WHEN a new product view is tracked and a product with the same CanonicalId already exists in the LocalStorage_Cache, THE Tracker SHALL remove the existing entry before prepending the new one, ensuring no CanonicalId appears more than once in the persisted data.

---

### Requirement 3: Authenticated User — Server-Backed Persistence

**User Story:** As a logged-in user, I want my recently viewed history synced across devices, so that I can continue browsing on any device and see what I looked at before.

#### Acceptance Criteria

1. WHEN the user becomes authenticated and Backend_Endpoint_GET has not yet been fetched in this session, THE Tracker SHALL fetch the History from Backend_Endpoint_GET.
2. WHEN Backend_Endpoint_GET responds successfully, THE Tracker SHALL replace the in-memory History and the LocalStorage_Cache with the server-returned list.
3. WHILE the initial Backend_Endpoint_GET fetch is in flight, THE Tracker SHALL expose `loading: true` to consumers.
4. WHEN the initial Backend_Endpoint_GET fetch completes (success or failure), THE Tracker SHALL set `loading: false`.
5. IF the Backend_Endpoint_GET fetch fails, THEN THE Tracker SHALL retain the existing LocalStorage_Cache state and set `loading: false` without surfacing an error to the user.
6. WHILE the user is authenticated and `trackView` is called, THE Tracker SHALL persist each view to Backend_Endpoint_POST in addition to the LocalStorage_Cache.

---

### Requirement 4: Deduplication — Most-Recent View Wins

**User Story:** As a user, I want each product to appear only once in my recently viewed list, so that the list stays clean and shows my latest browsing order.

#### Acceptance Criteria

1. WHEN `trackView` is called for a product whose CanonicalId already exists in the History, THE Tracker SHALL remove the existing entry, insert the new entry at position 0 (front), and the inserted entry SHALL carry all fields of the newly tracked product (title, price, imageUrl, platform, url) plus a `viewedAt` equal to the timestamp of the current `trackView` call — not the timestamp of the removed entry.
2. WHEN `trackView` is called for a product whose CanonicalId does not exist in the History, THE Tracker SHALL insert the new entry at position 0.
3. THE Tracker SHALL guarantee that after any `trackView` call completes, no CanonicalId appears more than once in the in-memory History.
4. WHEN `trackView` is called with a CanonicalId that is undefined, null, or empty string, THE Tracker SHALL not modify the History (see Requirement 1 criterion 4).

---

### Requirement 5: History Ordering — Most-Recent First

**User Story:** As a user, I want the most recently viewed product to appear first, so that I can quickly access the item I just looked at.

#### Acceptance Criteria

1. THE Tracker SHALL maintain the History in descending `viewedAt` order at all times (most-recent first).
2. WHEN Backend_Endpoint_GET returns items, THE Backend_Endpoint_GET SHALL sort the result by `viewedAt` descending before returning it to the client.
3. WHEN `syncAfterLogin` fetches the merged server state, THE Tracker SHALL replace the local History with the server-returned list, which is already sorted most-recent first.

---

### Requirement 6: Automatic Expiration via TTL

**User Story:** As a user, I want stale browsing history older than 30 days removed automatically, so that the list stays relevant without manual cleanup.

#### Acceptance Criteria

1. WHEN the LocalStorage_Cache is read (on initialisation or after logout), THE Tracker SHALL filter out any entry with `viewedAt < Cutoff`.
2. WHEN Backend_Endpoint_GET is called, THE Backend_Endpoint_GET SHALL filter out any entry with `viewedAt < Cutoff` before returning the list.
3. THE Backend_Endpoint_GET SHALL derive Cutoff as `Date.now() - TTL_MS` using the value of `process.env.RECENT_PRODUCTS_TTL_MS` (defaulting to `2592000000` ms — 30 days) at request time.
4. WHERE `RECENT_PRODUCTS_TTL_MS` is set as an environment variable, THE Backend_Endpoint_GET SHALL use the configured value instead of the default.
5. WHERE `RECENT_PRODUCTS_MAX` is set as an environment variable, THE Backend_Endpoint_POST SHALL use the configured value instead of the default of `20` for the `$slice` cap.

---

### Requirement 7: Configurable Maximum History Size

**User Story:** As an operator, I want to configure the maximum history length via environment variables, so that storage costs and payload sizes can be tuned without code changes.

#### Acceptance Criteria

1. THE Backend_Endpoint_POST SHALL cap the `recentProducts` array to MAX_RECENT items using `$push` with `$slice: MAX_RECENT` after every upsert.
2. THE Tracker SHALL trim the LocalStorage_Cache to MAX_RECENT items on every write.
3. WHEN the History already contains MAX_RECENT items and a new product is tracked, THE Tracker SHALL drop the oldest item (last position) to maintain the MAX_RECENT cap.
4. THE `.env` example file SHALL document `RECENT_PRODUCTS_MAX` (default `20`) and `RECENT_PRODUCTS_TTL_MS` (default `2592000000`) with descriptive comments.

---

### Requirement 8: Recently Viewed Section on the Homepage

**User Story:** As a returning visitor, I want to see my recently viewed products on the homepage, so that I can resume shopping without searching.

#### Acceptance Criteria

1. THE HomePage SHALL import and render `RecentlyViewedSection` after the "Today's biggest drops" deals section and before the Social Proof section.
2. THE HomePage SHALL pass the `items` array and `loading` flag from the Tracker to RecentlyViewedSection.
3. IF the History is empty AND `loading` is `false`, THEN THE RecentlyViewedSection SHALL render `null`, producing no DOM nodes and leaving no visual gap in the page layout.
4. WHEN `loading` is `true`, THE RecentlyViewedSection SHALL render four `ProductSkeleton` placeholder cards in a horizontal flex row, regardless of whether the cached History is empty or non-empty.
5. WHEN `loading` is `false` and the History contains at least one item, THE RecentlyViewedSection SHALL render a section with the heading text "Recently Viewed" and display the items using ProductCard with horizontal scrolling enabled (`overflow-x: auto`) on viewports narrower than `640px` (the `sm` Tailwind breakpoint).
6. WHEN `loading` is `false` and the History contains at least one item on viewports at or wider than `640px`, THE RecentlyViewedSection SHALL render the items in a 4-column CSS grid; on viewports at or wider than `1024px` (the `lg` breakpoint), the grid SHALL expand to 5 columns.
7. WHILE the horizontal scroll container has remaining scroll area to the left, THE RecentlyViewedSection SHALL render a left-scroll button that, when clicked, scrolls the container left by `240px` with `scroll-behavior: smooth`.
8. WHILE the horizontal scroll container has remaining scroll area to the right, THE RecentlyViewedSection SHALL render a right-scroll button that, when clicked, scrolls the container right by `240px` with `scroll-behavior: smooth`.

---

### Requirement 9: Recently Viewed Section on the Product Detail Page

**User Story:** As a user browsing a product, I want to see other products I viewed recently, so that I can compare or return to something I was considering.

#### Acceptance Criteria

1. THE ProductDetailPage SHALL render `RecentlyViewedSection` with `compact={true}` immediately before the ASCI affiliate disclosure paragraph (the `<p>` element containing the `#Ad` text).
2. THE ProductDetailPage SHALL derive the `items` prop for RecentlyViewedSection by filtering the Tracker's History to exclude any entry whose `id` equals the current page's `canonicalId`.
3. WHEN all History items have been excluded by criterion 2, or the History is empty, THE RecentlyViewedSection SHALL render `null` and produce no DOM nodes.
4. THE ProductDetailPage SHALL pass the `loading` flag from the Tracker to RecentlyViewedSection so that skeleton cards are shown while the initial server fetch is in flight.
5. WHEN `loading` is `true` and `compact={true}`, THE RecentlyViewedSection SHALL render four `ProductSkeleton` placeholder cards.
6. WHEN rendered with `compact={true}`, THE RecentlyViewedSection SHALL render the heading using the class `text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em]` and SHALL NOT render the left or right scroll arrow buttons.

---

### Requirement 10: Post-Login Sync — Merge Anonymous History into Backend

**User Story:** As a user who browsed anonymously and then logs in, I want my pre-login browsing history preserved, so that I do not lose product views I made before creating an account.

#### Acceptance Criteria

1. WHEN `syncAfterLogin` is called, THE Tracker SHALL read the current LocalStorage_Cache and POST each item to Backend_Endpoint_POST in ascending `viewedAt` order (oldest first) so that the final server array reflects the most-recent item at position 0 after all inserts complete.
2. WHEN dispatching individual POST calls in criterion 1, THE Tracker SHALL use `Promise.allSettled` so that a failure of any individual POST does not prevent the remaining POSTs from being dispatched or settled.
3. WHEN all POST calls from criterion 1 have settled (fulfilled or rejected), THE Tracker SHALL fetch the merged History from Backend_Endpoint_GET and replace both the in-memory History and the LocalStorage_Cache with the server-returned list.
4. IF the Backend_Endpoint_GET call in criterion 3 fails, THEN THE Tracker SHALL silently retain the current in-memory and LocalStorage_Cache History without surfacing an error.
5. WHEN the LocalStorage_Cache is empty at the time `syncAfterLogin` is called, THE Tracker SHALL return immediately without making any network requests.
6. THE AuthContext SHALL expose `setOnLoginSuccess` and `onLoginSuccess` so that consumers can register an async post-login callback.
7. WHEN a login, registration, or Google sign-in completes successfully, THE AuthContext SHALL call `await onLoginSuccess()` (if `onLoginSuccess` is non-null) and await its completion before calling `setLoading(false)`.
8. THE application root (a top-level component or `App.tsx`) SHALL call `setOnLoginSuccess(syncAfterLogin)` inside a `useEffect` that has `syncAfterLogin` in its dependency array, so that the latest `syncAfterLogin` reference is always registered and post-login sync runs on every login event.

---

### Requirement 11: Backend — GET /api/users/recent-products

**User Story:** As the client application, I need a reliable endpoint to retrieve the authenticated user's recently viewed products, so that server state can be displayed and synced to localStorage.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/users/recent-products` without a valid authentication token, THE Backend_Endpoint_GET SHALL return HTTP 401 with `{ "error": "Authentication required" }`.
2. WHEN a GET request is made with a valid authentication token, THE Backend_Endpoint_GET SHALL return HTTP 200 with `{ "products": [...] }`.
3. THE Backend_Endpoint_GET response body SHALL include only items where `viewedAt >= Cutoff`.
4. THE Backend_Endpoint_GET response SHALL sort items by `viewedAt` descending and limit to MAX_RECENT items.
5. WHEN the UserPreferences document does not exist for the authenticated user, THE Backend_Endpoint_GET SHALL return HTTP 200 with `{ "products": [] }`.
6. IF a non-GET method is used against `/api/users/recent-products`, THEN THE route handler SHALL return HTTP 405 with `{ "error": "Method not allowed" }`.

---

### Requirement 12: Backend — POST /api/users/recent-products

**User Story:** As the client application, I need an endpoint to record a product view for the authenticated user, so that the history is persisted durably across sessions and devices.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/users/recent-products` without a valid authentication token, THE Backend_Endpoint_POST SHALL return HTTP 401 with `{ "error": "Authentication required" }`.
2. WHEN a POST request is made with a body missing any of `canonicalId`, `title`, `price`, `platform`, or `url`, THE Backend_Endpoint_POST SHALL return HTTP 400 with `{ "error": "canonicalId, title, price, platform, url are required" }`.
3. WHEN a valid POST request is received, THE Backend_Endpoint_POST SHALL atomically remove any existing entry with the same `canonicalId` using `$pull`, then prepend the new entry at position `0` using `$push` with `$each`, `$position: 0`, and `$slice: MAX_RECENT`.
4. WHEN the UserPreferences document does not exist for the authenticated user, THE Backend_Endpoint_POST SHALL create it via `upsert: true` with `$setOnInsert`.
5. WHEN the POST succeeds, THE Backend_Endpoint_POST SHALL return HTTP 201 with `{ "success": true }`.
6. THE Backend_Endpoint_POST SHALL record `viewedAt` as the server's current time (`new Date()`) for each entry, ignoring any client-provided timestamp.

---

### Requirement 13: Non-Functional — Performance and Resilience

**User Story:** As a user, I want the recently viewed list to appear instantly without blocking the main page interaction, so that tracking does not degrade my experience.

#### Acceptance Criteria

1. WHEN `trackView` is called, THE Tracker SHALL update the UI synchronously within the same React render before any async operation, producing no loading flash for the view tracking itself.
2. THE Backend_Endpoint_POST write SHALL be fire-and-forget from the client perspective — the Tracker SHALL NOT await its result before updating the UI.
3. THE Backend_Endpoint_POST SHALL use atomic MongoDB operations (`$pull`, `$push` with `$slice`) across two sequential writes to avoid full document read-modify-write cycles; the known two-write limitation is acceptable and SHALL be documented.
4. IF a `localStorage` write throws a `QuotaExceededError` or any other exception, THEN THE Tracker SHALL catch it silently and continue without propagating the error.
5. THE feature SHALL require no MongoDB schema migration; the `recentProducts` field already exists in `UserPreferences` with `default: []`.

---

### Requirement 14: Correctness Properties (Property-Based Tests)

**User Story:** As a developer, I want property-based tests for the core deduplication and TTL logic, so that edge cases across arbitrary inputs are reliably caught before deployment.

#### Acceptance Criteria

1. **P1 — MAX_RECENT cap invariant**: FOR ALL sequences of N distinct product track operations where N > MAX_RECENT, THE History length SHALL be less than or equal to MAX_RECENT after all operations complete.
2. **P2 — Deduplication invariant**: FOR ALL pairs of track operations on the same CanonicalId, THE History SHALL contain exactly one entry for that CanonicalId, and that entry SHALL be at position 0 with the most recently tracked `viewedAt`.
3. **P3 — TTL expiry invariant**: FOR ALL History lists containing entries with arbitrary `viewedAt` values, WHEN the TTL filter is applied, THE resulting list SHALL contain no entry with `viewedAt < Cutoff`.
4. **P4 — Sort order invariant**: FOR ALL non-empty History lists, EACH item's `viewedAt` SHALL be greater than or equal to the `viewedAt` of the next item (most-recent first).
5. **P5 — Current-product exclusion metamorphic property**: FOR ALL History lists and any CanonicalId value X, WHEN X is filtered out for the product detail page view, THE count of remaining items SHALL equal the count of items in the original list whose `id !== X`.
6. THE property tests SHALL be implemented in `tests/properties/recentlyViewed.prop.ts` using `fast-check` and `vitest`, following the pattern in `tests/properties/search.prop.ts`.
7. Integration tests SHALL be implemented in `tests/integration/recentlyViewedSection.integration.test.tsx`, covering: (a) RecentlyViewedSection renders on HomePage after the deals section, (b) RecentlyViewedSection renders on ProductDetailPage with `compact` prop and excludes the current product.
