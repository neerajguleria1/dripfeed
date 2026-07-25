import mongoose from 'mongoose';

/**
 * AnalyticsEvent — one document per tracked user interaction.
 *
 * Privacy guarantees:
 *   - No userId, no email, no IP address stored
 *   - sessionId is a random UUID generated client-side per browser session
 *   - TTL index auto-deletes after 90 days
 *   - versionKey disabled to save bytes
 */

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

export interface IAnalyticsEvent {
  event:       EventName;
  sessionId:   string;          // anonymous random UUID, no PII
  device:      'mobile' | 'web';
  ts:          Date;            // event timestamp — drives TTL
  // Optional context fields — all nullable
  query?:      string;          // search query
  platform?:   string;         // retailer platform
  canonicalId?: string;        // product canonical ID
  productTitle?: string;       // product title (no user data)
  section?:    string;         // recommendation section type
  latencyMs?:  number;         // search latency in ms
  resultCount?: number;        // number of results returned
  targetPrice?: number;        // alert target price
}

const RETENTION_DAYS = 90;

const schema = new mongoose.Schema<IAnalyticsEvent>(
  {
    event:        { type: String, required: true, index: true },
    sessionId:    { type: String, required: true },
    device:       { type: String, default: 'web' },
    ts:           { type: Date, required: true, default: Date.now },
    query:        { type: String },
    platform:     { type: String },
    canonicalId:  { type: String },
    productTitle: { type: String },
    section:      { type: String },
    latencyMs:    { type: Number },
    resultCount:  { type: Number },
    targetPrice:  { type: Number },
  },
  { versionKey: false }
);

// TTL — auto-deletes after 90 days
schema.index({ ts: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86400 });
// Dashboard aggregation paths
schema.index({ event: 1, ts: -1 });
schema.index({ query: 1, event: 1 });
schema.index({ platform: 1, event: 1 });

const AnalyticsEvent =
  (mongoose.models.AnalyticsEvent as mongoose.Model<IAnalyticsEvent>) ||
  mongoose.model<IAnalyticsEvent>('AnalyticsEvent', schema);

export default AnalyticsEvent;
