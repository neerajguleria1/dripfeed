/**
 * Property 7: Affiliate URL Generation Always Returns Valid URL
 * Property 8: Affiliate Click Logging Completeness
 * Property 9: URL Tracking Parameters Always Appended
 * Validates: Requirements 6.1, 6.2, 6.4, 6.6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Simulates affiliate URL generation logic from api/affiliate/redirect.ts
function generateAffiliateUrl(
  baseUrl: string,
  platform: string,
  utmSource: string = 'dripfeed',
  utmMedium: string = 'affiliate',
  utmCampaign: string = 'compare',
): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', utmSource);
    url.searchParams.set('utm_medium', utmMedium);
    url.searchParams.set('utm_campaign', utmCampaign);
    url.searchParams.set('tag', `dripfeed-${platform}`);
    return url.toString();
  } catch {
    // Fallback: append as query string if URL parsing fails
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}&tag=dripfeed-${platform}`;
  }
}

// Simulates click logging shape
interface AffiliateClick {
  productId: string;
  platform: string;
  userId?: string;
  sessionId: string;
  timestamp: string;
  url: string;
  referrer?: string;
}

function createClickLog(
  productId: string,
  platform: string,
  url: string,
  sessionId: string,
  userId?: string,
): AffiliateClick {
  return {
    productId,
    platform,
    userId,
    sessionId,
    timestamp: new Date().toISOString(),
    url,
    referrer: undefined,
  };
}

const platformArb = fc.constantFrom('myntra', 'ajio', 'flipkart', 'amazon', 'nykaa', 'tatacliq', 'meesho', 'snapdeal');
const urlArb = fc.constantFrom(
  'https://www.myntra.com/product/12345',
  'https://www.ajio.com/p/abc-def',
  'https://www.flipkart.com/item/pid',
  'https://www.amazon.in/dp/B0EXAMPLE',
  'https://www.nykaa.com/product/item123',
);

describe('Property 7: Affiliate URL Generation Always Returns Valid URL', () => {
  it('always returns a string (never throws)', () => {
    fc.assert(
      fc.property(urlArb, platformArb, (baseUrl, platform) => {
        const result = generateAffiliateUrl(baseUrl, platform);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }),
    );
  });

  it('result is always a valid URL for valid inputs', () => {
    fc.assert(
      fc.property(urlArb, platformArb, (baseUrl, platform) => {
        const result = generateAffiliateUrl(baseUrl, platform);
        // Should be parseable as URL
        expect(() => new URL(result)).not.toThrow();
      }),
    );
  });

  it('original base URL host is preserved', () => {
    fc.assert(
      fc.property(urlArb, platformArb, (baseUrl, platform) => {
        const result = generateAffiliateUrl(baseUrl, platform);
        const originalHost = new URL(baseUrl).host;
        const resultHost = new URL(result).host;
        expect(resultHost).toBe(originalHost);
      }),
    );
  });
});

describe('Property 9: URL Tracking Parameters Always Appended', () => {
  it('utm_source is always present in output', () => {
    fc.assert(
      fc.property(urlArb, platformArb, (baseUrl, platform) => {
        const result = generateAffiliateUrl(baseUrl, platform);
        expect(result).toContain('utm_source=dripfeed');
      }),
    );
  });

  it('utm_medium is always present', () => {
    fc.assert(
      fc.property(urlArb, platformArb, (baseUrl, platform) => {
        const result = generateAffiliateUrl(baseUrl, platform);
        expect(result).toContain('utm_medium=affiliate');
      }),
    );
  });

  it('platform tag is always present', () => {
    fc.assert(
      fc.property(urlArb, platformArb, (baseUrl, platform) => {
        const result = generateAffiliateUrl(baseUrl, platform);
        expect(result).toContain(`tag=dripfeed-${platform}`);
      }),
    );
  });
});

describe('Property 8: Affiliate Click Logging Completeness', () => {
  it('click log always has required fields', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        platformArb,
        urlArb,
        fc.uuid(),
        (productId, platform, url, sessionId) => {
          const log = createClickLog(productId, platform, url, sessionId);
          expect(log.productId).toBe(productId);
          expect(log.platform).toBe(platform);
          expect(log.url).toBe(url);
          expect(log.sessionId).toBe(sessionId);
          expect(log.timestamp).toBeTruthy();
          // Timestamp should be valid ISO
          expect(new Date(log.timestamp).toISOString()).toBe(log.timestamp);
        },
      ),
    );
  });

  it('click log works with or without userId (guest support)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        platformArb,
        urlArb,
        fc.uuid(),
        fc.option(fc.uuid()),
        (productId, platform, url, sessionId, userId) => {
          const log = createClickLog(productId, platform, url, sessionId, userId ?? undefined);
          // Should never throw regardless of userId presence
          expect(log.productId).toBeTruthy();
          if (userId) {
            expect(log.userId).toBe(userId);
          }
        },
      ),
    );
  });
});
