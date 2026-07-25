/**
 * analytics.ts  (frontend)
 *
 * Client-side event tracker.
 *
 * Design:
 *   - Anonymous session ID stored in sessionStorage (cleared on tab close)
 *   - Events are micro-batched: flushed every 3s or when batch reaches 10
 *   - Uses navigator.sendBeacon on page unload for reliability
 *   - Never throws — all errors are silently swallowed
 *   - No cookies, no PII, no user IDs
 */

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const FLUSH_INTERVAL_MS = 3000;
const MAX_BATCH_SIZE    = 10;

// ─── Session ID ───────────────────────────────────────────────────────────────

function getSessionId(): string {
  try {
    const key = 'tc_sid';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

function getDevice(): 'mobile' | 'web' {
  return /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'web';
}

// ─── Event types ──────────────────────────────────────────────────────────────

export type EventName =
  | 'search_performed'
  | 'search_result_viewed'
  | 'product_card_clicked'
  | 'product_detail_viewed'
  | 'compare_opened'
  | 'compare_completed'
  | 'affiliate_link_clicked'
  | 'wishlist_added'
  | 'wishlist_removed'
  | 'share_clicked'
  | 'price_history_expanded'
  | 'recommendation_clicked'
  | 'recommendation_section_viewed'
  | 'no_results_search'
  | '404_product'
  | 'alert_created'
  | 'alert_cancelled'
  | 'alert_triggered'
  | 'alert_opened'
  | 'alert_conversion';

export interface TrackPayload {
  event:         EventName;
  query?:        string;
  platform?:     string;
  canonicalId?:  string;
  productTitle?: string;
  section?:      string;
  latencyMs?:    number;
  resultCount?:  number;
  targetPrice?:  number;
}

// ─── Batch queue ──────────────────────────────────────────────────────────────

type QueuedEvent = TrackPayload & { sessionId: string; device: 'mobile' | 'web' };

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
}

function flush() {
  flushTimer = null;
  if (!queue.length) return;
  const batch = queue.splice(0, queue.length);
  try {
    fetch(`${API_BASE}/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      // keepalive allows the request to outlive the page
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never throw
  }
}

// Flush on page unload using sendBeacon for reliability
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function track(payload: TrackPayload): void {
  try {
    queue.push({
      ...payload,
      sessionId: getSessionId(),
      device:    getDevice(),
    });
    if (queue.length >= MAX_BATCH_SIZE) {
      flush();
    } else {
      scheduleFlush();
    }
  } catch {
    // Never throw
  }
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export const Analytics = {
  searchPerformed:   (query: string, latencyMs?: number, resultCount?: number) =>
    track({ event: 'search_performed', query, latencyMs, resultCount }),

  searchResultViewed: (query: string, resultCount: number) =>
    track({ event: 'search_result_viewed', query, resultCount }),

  productCardClicked: (canonicalId: string, productTitle: string, platform: string) =>
    track({ event: 'product_card_clicked', canonicalId, productTitle, platform }),

  productDetailViewed: (canonicalId: string, productTitle: string) =>
    track({ event: 'product_detail_viewed', canonicalId, productTitle }),

  compareOpened: (query: string) =>
    track({ event: 'compare_opened', query }),

  compareCompleted: (query: string, resultCount: number) =>
    track({ event: 'compare_completed', query, resultCount }),

  affiliateLinkClicked: (platform: string, productTitle: string, canonicalId?: string) =>
    track({ event: 'affiliate_link_clicked', platform, productTitle, canonicalId }),

  wishlistAdded: (productTitle: string, platform: string) =>
    track({ event: 'wishlist_added', productTitle, platform }),

  wishlistRemoved: (productTitle: string) =>
    track({ event: 'wishlist_removed', productTitle }),

  shareClicked: (canonicalId: string, productTitle: string) =>
    track({ event: 'share_clicked', canonicalId, productTitle }),

  priceHistoryExpanded: (canonicalId: string) =>
    track({ event: 'price_history_expanded', canonicalId }),

  recommendationClicked: (canonicalId: string, section: string, productTitle: string) =>
    track({ event: 'recommendation_clicked', canonicalId, section, productTitle }),

  recommendationSectionViewed: (section: string) =>
    track({ event: 'recommendation_section_viewed', section }),

  noResultsSearch: (query: string) =>
    track({ event: 'no_results_search', query }),

  product404: (canonicalId: string) =>
    track({ event: '404_product', canonicalId }),

  alertCreated: (canonicalId: string, productTitle: string, targetPrice: number) =>
    track({ event: 'alert_created', canonicalId, productTitle, targetPrice }),

  alertCancelled: (canonicalId: string, productTitle: string) =>
    track({ event: 'alert_cancelled', canonicalId, productTitle }),

  alertOpened: (canonicalId: string, productTitle: string) =>
    track({ event: 'alert_opened', canonicalId, productTitle }),

  alertConversion: (canonicalId: string, productTitle: string) =>
    track({ event: 'alert_conversion', canonicalId, productTitle }),
};

export default Analytics;
