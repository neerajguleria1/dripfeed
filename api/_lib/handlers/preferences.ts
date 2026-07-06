// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import { getUserFromRequest } from '../auth.js';
import UserPreferences from '../models/UserPreferences.js';

const DEFAULTS = {
  categories: [] as string[],
  brands: [] as string[],
  priceRange: { min: 0, max: 10000 },
  occasions: [] as string[],
  onboardingCompleted: false,
  searchHistory: [] as { query: string; timestamp: Date }[],
};

async function preferencesHandler(req: VercelRequest, res: VercelResponse) {
  await connectDB();

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const prefs = await UserPreferences.findOne({ userId: user.userId }).lean();
    if (!prefs) return res.json(DEFAULTS);
    return res.json({
      categories: prefs.categories ?? [],
      brands: prefs.brands ?? [],
      priceRange: prefs.priceRange ?? { min: 0, max: 10000 },
      occasions: prefs.occasions ?? [],
      onboardingCompleted: prefs.onboardingCompleted ?? false,
      searchHistory: prefs.searchHistory ?? [],
    });
  }

  if (req.method === 'PUT') {
    const { categories, brands, priceRange, occasions, onboardingCompleted, searchHistory } = req.body || {};

    const update: Record<string, unknown> = {};
    if (categories !== undefined) update.categories = categories;
    if (brands !== undefined) update.brands = brands;
    if (priceRange !== undefined) update.priceRange = priceRange;
    if (occasions !== undefined) update.occasions = occasions;
    if (onboardingCompleted !== undefined) update.onboardingCompleted = onboardingCompleted;
    if (searchHistory !== undefined) {
      const history = Array.isArray(searchHistory) ? searchHistory.slice(-30) : [];
      update.searchHistory = history;
    }

    const prefs = await UserPreferences.findOneAndUpdate(
      { userId: user.userId },
      { $set: update, $setOnInsert: { userId: user.userId } },
      { upsert: true, new: true, lean: true }
    );

    return res.json({
      categories: prefs.categories ?? [],
      brands: prefs.brands ?? [],
      priceRange: prefs.priceRange ?? { min: 0, max: 10000 },
      occasions: prefs.occasions ?? [],
      onboardingCompleted: prefs.onboardingCompleted ?? false,
      searchHistory: prefs.searchHistory ?? [],
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export async function handlePreferences(req: VercelRequest, res: VercelResponse, subpath: string) {
  // /api/preferences only has the index route
  const cleaned = subpath.startsWith('/') ? subpath.slice(1) : subpath;

  if (!cleaned || cleaned === '') {
    return preferencesHandler(req, res);
  }

  return res.status(404).json({ error: 'Not found' });
}
