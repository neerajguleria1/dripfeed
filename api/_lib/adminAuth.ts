/**
 * adminAuth.ts
 *
 * Shared guard for admin-only API endpoints.
 *
 * Design decision: extracted as a standalone module rather than inlined in
 * each handler so the check is a single auditable location. Any future change
 * to the admin role name or multi-role logic happens here only.
 *
 * Uses the existing getUserFromRequest() from auth.ts — no new JWT logic,
 * no new dependencies.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './auth.js';

/**
 * Returns true if the request carries a valid JWT with role === 'admin'.
 * Returns false and writes a 401/403 response otherwise.
 *
 * Usage:
 *   if (!requireAdmin(req, res)) return;
 */
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const payload = getUserFromRequest(req);

  if (!payload) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }

  if (payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }

  return true;
}
