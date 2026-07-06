// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuth } from './_lib/handlers/auth.js';
import { handleProducts } from './_lib/handlers/products.js';
import { handleSearch } from './_lib/handlers/search.js';
import { handleCollections } from './_lib/handlers/collections.js';
import { handleWishlist } from './_lib/handlers/wishlist.js';
import { handleThrift } from './_lib/handlers/thrift.js';
import { handleFeed } from './_lib/handlers/feed.js';
import { handlePreferences } from './_lib/handlers/preferences.js';
import { handleAffiliate } from './_lib/handlers/affiliate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req;
  const path = new URL(url!, `http://${req.headers.host}`).pathname.replace(/^\/api\/?/, '');

  // Route to appropriate handler
  if (path.startsWith('auth/')) return handleAuth(req, res, path.replace('auth/', ''));
  if (path.startsWith('products/')) return handleProducts(req, res, path.replace('products/', ''));
  if (path.startsWith('search/')) return handleSearch(req, res, path.replace('search/', ''));
  if (path.startsWith('collections')) return handleCollections(req, res, path.replace('collections', ''));
  if (path.startsWith('wishlist')) return handleWishlist(req, res, path.replace('wishlist', ''));
  if (path.startsWith('thrift')) return handleThrift(req, res, path.replace('thrift', ''));
  if (path.startsWith('feed/')) return handleFeed(req, res, path.replace('feed/', ''));
  if (path.startsWith('preferences')) return handlePreferences(req, res, path.replace('preferences', ''));
  if (path.startsWith('affiliate/')) return handleAffiliate(req, res, path.replace('affiliate/', ''));
  if (path.startsWith('analytics/')) return res.status(200).json({ ok: true }); // fire-and-forget

  return res.status(404).json({ error: 'Not found' });
}
