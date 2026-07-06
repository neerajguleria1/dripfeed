// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import AffiliateClick from '../models/AffiliateClick.js';
import { buildAffiliateUrl } from '../affiliate.js';
import { getUserFromRequest } from '../auth.js';

function appendUtmParams(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('utm_source')) {
      parsed.searchParams.set('utm_source', 'dripfeed');
    }
    if (!parsed.searchParams.has('utm_medium')) {
      parsed.searchParams.set('utm_medium', 'affiliate');
    }
    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}utm_source=dripfeed&utm_medium=affiliate`;
  }
}

function parseBrowser(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
  return 'other';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateAffiliateUrlWithRetry(platform: string, productUrl: string): Promise<string> {
  try {
    const url = buildAffiliateUrl(platform, productUrl);
    return appendUtmParams(url);
  } catch {
    await delay(200);
    try {
      const url = buildAffiliateUrl(platform, productUrl);
      return appendUtmParams(url);
    } catch {
      return appendUtmParams(productUrl);
    }
  }
}

async function redirect(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, productUrl, productName, device, sessionId } = req.body || {};
  if (!platform || !productUrl) {
    return res.status(400).json({ error: 'platform and productUrl are required' });
  }

  try {
    const affiliateUrl = await generateAffiliateUrlWithRetry(platform, productUrl);
    const userAgent = req.headers['user-agent'];
    const browser = parseBrowser(userAgent);

    try {
      await connectDB();
      const user = getUserFromRequest(req);
      await AffiliateClick.create({
        userId: user?.userId,
        platform,
        productTitle: productName || 'Unknown',
        sourceUrl: productUrl,
        affiliateUrl,
        device: device || 'web',
        browser,
        sessionId: sessionId || undefined,
      });
    } catch {
      // Never block redirect due to logging failure
    }

    return res.json({ affiliateUrl });
  } catch {
    return res.json({ affiliateUrl: appendUtmParams(productUrl) });
  }
}

export async function handleAffiliate(req: VercelRequest, res: VercelResponse, subpath: string) {
  switch (subpath) {
    case 'redirect': return redirect(req, res);
    default: return res.status(404).json({ error: 'Not found' });
  }
}
