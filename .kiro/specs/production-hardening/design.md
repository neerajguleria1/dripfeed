# Production Hardening Design

## Architecture Overview

All changes are surgical fixes to existing files. No new packages. No new
architectural patterns. The existing handler/router/model structure is preserved.

---

## Fix 1 — Analytics Routing (REQ-1)

### Root cause
`api/[[...route]].ts` line:
```ts
if (path.startsWith('analytics/')) return res.status(200).json({ ok: true });
```
This guard appears BEFORE the `handleAnalytics` dispatcher, intercepting every
analytics request. It was likely a temporary stub that was never removed.

### Fix
1. Remove the stub guard from `[[...route]].ts`.
2. The existing `handleAnalytics` routing (already at the bottom of the file) then
   handles both `analytics/event` (POST, no auth) and `analytics/dashboard` (GET, admin).
3. Fix the duplicate import and duplicate guard in `handlers/analytics.ts`.

### No-change guarantee
The `enqueueEvent` / `getDashboardMetrics` logic in `analytics.ts` is untouched.
Event batching, LRU caching, and flush behavior are unchanged.

---

## Fix 2 — Debug Security (REQ-2)

### Root cause
`handleDebug` contains live ScraperAPI calls and exposes env var status with no
authentication.

### Fix
Add `requireAdmin(req, res)` as the first check in `handleDebug`. Existing logic
is unchanged.

---

## Fix 3 — Cron Scheduling (REQ-3)

### Root cause
`vercel.json` crons array only has 2 entries; `deals-refresh` and `populate-catalog`
handlers exist but are not scheduled.

### Fix
Add both to the `crons` array in `vercel.json`. Add console logging to both
handlers for observability.

---

## Fix 4 — Format Consolidation (REQ-4)

### Strategy: Additive re-export (zero breaking changes)
- `formatPrice.ts` is extended with `formatINR` alias and `discountPercent` alias.
- `format.ts` is replaced with a pure re-export shim — all existing callers
  importing from `../utils/format` continue to work unchanged.
- `SearchPage.tsx` removes its inline function and imports `formatPrice` from
  the canonical util.

### Data flow unchanged
All formatting still uses `toLocaleString('en-IN')`.

---

## Fix 5 — Wishlist Real Price History (REQ-5)

### Backend change (handlers/wishlist.ts)
After fetching wishlist items, a single aggregation query retrieves price history
for all items in one DB round-trip:

```
PriceHistory.find({ canonicalId: { $in: titles } })
  .sort({ recordedAt: 1 })
  .select('canonicalId price recordedAt')
```

Since `WishlistItem` stores `productTitle` but `PriceHistory` stores `canonicalId`,
we use a title-to-id lookup via `SearchCache.canonicalIds`. If no match, history
is `[]`.

Actually, simpler: query `PriceHistory` by `productTitle` directly if that index
exists, or fall back to a lookup through the SearchCache's `results` array for the
matching title. To avoid complexity and extra queries, we store a `priceHistory`
field as last 7 prices directly computed from the `PriceHistory` collection where
`productTitle` matches (case-insensitive). Limit 7 per item. Sorted oldest-first.

### Frontend change (WishlistPage.tsx)
- Remove `mockPriceHistory()` function.
- Read `item.priceHistory` from the API response.
- Pass to `<Sparkline data={item.priceHistory || []} />`.

---

## Fix 6 — Dead Code (REQ-6)

Standard file deletion after import verification via grep.
