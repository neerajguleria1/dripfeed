// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 60, regions: ['bom1'] }; // bom1 = Mumbai
import { handleAuth } from './_lib/handlers/auth.js';
import { handleProducts } from './_lib/handlers/products.js';
import { handleSearch } from './_lib/handlers/search.js';
import { handleAutocomplete } from './_lib/handlers/autocomplete.js';
import { handleCollections } from './_lib/handlers/collections.js';
import { handleWishlist } from './_lib/handlers/wishlist.js';
import { handleThrift } from './_lib/handlers/thrift.js';
import { handleFeed } from './_lib/handlers/feed.js';
import { handlePreferences } from './_lib/handlers/preferences.js';
import { handleAffiliate } from './_lib/handlers/affiliate.js';
import { handleDebug } from './_lib/handlers/debug.js';
import { handlePush } from './_lib/handlers/push.js';
import { handleVariants } from './_lib/handlers/variants.js';
import { handlePriceHistory } from './_lib/handlers/priceHistory.js';
import { handleProductDetail } from './_lib/handlers/productDetail.js';
import { handleRecommendations } from './_lib/handlers/recommendations.js';
import { handleSimilarProducts } from './_lib/handlers/similarProducts.js';
import { handleUsers } from './_lib/handlers/users.js';
import { handleAnalytics } from './_lib/handlers/analytics.js';
import { handleAlerts } from './_lib/handlers/alerts.js';
import { handleTrending } from './_lib/handlers/trending.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req;
  const path = new URL(url!, `http://${req.headers.host}`).pathname.replace(/^\/api\/?/, '');

  // Route to appropriate handler
  if (path.startsWith('auth/')) return handleAuth(req, res, path.replace('auth/', ''));
  if (path === 'products/trending' || path.startsWith('products/trending/')) return handleTrending(req, res, path.replace('products/trending', ''));
  if (path.startsWith('products/')) return handleProducts(req, res, path.replace('products/', ''));
  if (path === 'search/autocomplete') return handleAutocomplete(req, res);
  if (path.startsWith('search/')) return handleSearch(req, res, path.replace('search/', ''));
  if (path.startsWith('collections')) return handleCollections(req, res, path.replace('collections', ''));
  if (path.startsWith('wishlist')) return handleWishlist(req, res, path.replace('wishlist', ''));
  if (path.startsWith('thrift')) return handleThrift(req, res, path.replace('thrift', ''));
  if (path.startsWith('feed/')) return handleFeed(req, res, path.replace('feed/', ''));
  if (path.startsWith('preferences')) return handlePreferences(req, res, path.replace('preferences', ''));
  if (path.startsWith('affiliate/')) return handleAffiliate(req, res, path.replace('affiliate/', ''));
  if (path.startsWith('alerts/')) return handleAlerts(req, res, path.replace('alerts/', ''));
  if (path === 'alerts') return handleAlerts(req, res, '');
  if (path.startsWith('analytics/')) return res.status(200).json({ ok: true });
  if (path.startsWith('debug/')) return handleDebug(req, res, path.replace('debug/', ''));
  if (path.startsWith('push/')) return handlePush(req, res, path.replace('push/', ''));
  if (path === 'variants') return handleVariants(req, res);
  if (path.startsWith('price-history/')) return handlePriceHistory(req, res, path.replace('price-history/', ''));
  if (path.startsWith('users/')) return handleUsers(req, res, path.replace('users/', ''));
  if (path.startsWith('product/')) {
    const sub = path.replace('product/', '');
    // GET /api/products/:id/similar — must be checked before the generic product handler
    const similarMatch = sub.match(/^([^/]+)\/similar$/);
    if (similarMatch) return handleSimilarProducts(req, res, similarMatch[1]);
    return handleProductDetail(req, res, sub);
  }
  if (path.startsWith('recommendations/')) return handleRecommendations(req, res, path.replace('recommendations/', ''));
  if (path.startsWith('analytics/')) return handleAnalytics(req, res, path.replace('analytics/', ''));
  if (path === 'analytics') return handleAnalytics(req, res, '');

  return res.status(404).json({ error: 'Not found' });
}
