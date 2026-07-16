// Local dev server — wraps the existing Vercel handlers in Express
// Run: npm run dev:api   (uses tsx to execute TypeScript directly)

import 'dotenv/config';
import express from 'express';
import { handleAuth } from './_lib/handlers/auth.js';
import { handleProducts } from './_lib/handlers/products.js';
import { handleSearch } from './_lib/handlers/search.js';
import { handleCollections } from './_lib/handlers/collections.js';
import { handleWishlist } from './_lib/handlers/wishlist.js';
import { handleThrift } from './_lib/handlers/thrift.js';
import { handleFeed } from './_lib/handlers/feed.js';
import { handlePreferences } from './_lib/handlers/preferences.js';
import { handleAffiliate } from './_lib/handlers/affiliate.js';
import { handleDebug } from './_lib/handlers/debug.js';
import { handlePush } from './_lib/handlers/push.js';

const app = express();
app.use(express.json());

// CORS for local Vite dev server
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Route all /api/* to the right handler — mirrors [[...route]].ts logic
app.all('/api/*', (req: any, res: any) => {
  const path = req.path.replace(/^\/api\/?/, '');

  if (path.startsWith('auth/'))        return handleAuth(req, res, path.replace('auth/', ''));
  if (path.startsWith('products/'))    return handleProducts(req, res, path.replace('products/', ''));
  if (path.startsWith('search/'))      return handleSearch(req, res, path.replace('search/', ''));
  if (path.startsWith('collections'))  return handleCollections(req, res, path.replace('collections', ''));
  if (path.startsWith('wishlist'))     return handleWishlist(req, res, path.replace('wishlist', ''));
  if (path.startsWith('thrift'))       return handleThrift(req, res, path.replace('thrift', ''));
  if (path.startsWith('feed/'))        return handleFeed(req, res, path.replace('feed/', ''));
  if (path.startsWith('preferences'))  return handlePreferences(req, res, path.replace('preferences', ''));
  if (path.startsWith('affiliate/'))   return handleAffiliate(req, res, path.replace('affiliate/', ''));
  if (path.startsWith('analytics/'))   return res.status(200).json({ ok: true });
  if (path.startsWith('debug/'))       return handleDebug(req, res, path.replace('debug/', ''));
  if (path.startsWith('push/'))        return handlePush(req, res, path.replace('push/', ''));

  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 API server running at http://localhost:${PORT}`);
  console.log(`   MONGO_URI:       ${process.env.MONGO_URI ? '✓ set' : '✗ missing'}`);
  console.log(`   SCRAPER_API_KEY: ${process.env.SCRAPER_API_KEY ? '✓ set' : '✗ missing'}`);
  console.log(`   JWT_SECRET:      ${process.env.JWT_SECRET ? '✓ set' : '⚠ using insecure fallback'}`);
  console.log(`   GROQ_API_KEY:    ${process.env.GROQ_API_KEY ? '✓ set' : '✗ missing (AI advice disabled)'}\n`);
});
