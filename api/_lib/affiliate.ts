/**
 * Builds affiliate URLs for each platform.
 * If affiliate ID is not configured, returns the original URL (never blocks the user).
 */

const VCOMMISSION_ID = process.env.AFFILIATE_VCOMMISSION_ID || '';
const AMAZON_TAG = process.env.AFFILIATE_AMAZON_TAG || '';
const FLIPKART_ID = process.env.AFFILIATE_FLIPKART_ID || '';
const CUELINKS_ID = process.env.AFFILIATE_CUELINKS_ID || '';

export function buildAffiliateUrl(platform: string, originalUrl: string): string {
  const p = platform.toLowerCase();

  try {
    if (p.includes('amazon')) {
      if (!AMAZON_TAG) return originalUrl;
      const url = new URL(originalUrl);
      url.searchParams.set('tag', `${AMAZON_TAG}-21`);
      url.searchParams.set('utm_source', 'dripfeed');
      url.searchParams.set('utm_medium', 'affiliate');
      return url.toString();
    }

    if (p.includes('flipkart')) {
      if (!FLIPKART_ID && !CUELINKS_ID) return originalUrl;
      if (FLIPKART_ID) {
        const url = new URL(originalUrl);
        url.searchParams.set('affid', FLIPKART_ID);
        url.searchParams.set('utm_source', 'dripfeed');
        return url.toString();
      }
      // Fallback to Cuelinks
      return `https://www.cuelinks.com/redirect?pid=${CUELINKS_ID}&url=${encodeURIComponent(originalUrl)}`;
    }

    if (p.includes('myntra') || p.includes('ajio') || p.includes('nykaa') || p.includes('meesho') || p.includes('shein') || p.includes('bewakoof')) {
      if (!VCOMMISSION_ID) return originalUrl;
      return `https://linksredirect.com/?pub_id=${VCOMMISSION_ID}&source=linkkit&url=${encodeURIComponent(originalUrl)}&utm_source=dripfeed&utm_medium=affiliate`;
    }

    if (p.includes('tata') || p.includes('cliq')) {
      if (!CUELINKS_ID) return originalUrl;
      return `https://www.cuelinks.com/redirect?pid=${CUELINKS_ID}&url=${encodeURIComponent(originalUrl)}`;
    }

    // Unknown platform — return as-is
    return originalUrl;
  } catch {
    // Never throw — return original URL on any error
    return originalUrl;
  }
}
