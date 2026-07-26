/**
 * handlers/queryInterpret.ts
 *
 * POST /api/search/interpret
 *
 * Interprets a natural-language query and returns structured filters.
 * No authentication required — public endpoint (rate-limiting via existing
 * Vercel platform layer).
 *
 * Body: { query: string }
 * Response: ParsedQuery (see queryInterpreter.ts)
 */

// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { interpretQuery, buildFilterChips } from '../queryInterpreter.js';

export async function handleQueryInterpret(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const raw = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (!raw) {
    res.status(400).json({ error: 'query is required' });
    return;
  }
  if (raw.length > 300) {
    res.status(400).json({ error: 'query too long (max 300 chars)' });
    return;
  }

  try {
    const result = await interpretQuery(raw);
    const chips  = buildFilterChips(result.filters);

    // CDN-cache for 30 min (same as LRU TTL) — safe because results are deterministic
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    res.json({ ...result, chips });
  } catch (e: any) {
    console.error('[queryInterpret] error:', e?.message?.slice(0, 100));
    res.status(500).json({ error: 'Failed to interpret query', message: e?.message });
  }
}
