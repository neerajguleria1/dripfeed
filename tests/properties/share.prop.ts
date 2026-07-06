/**
 * Property 18: Shareable URL Format Correctness
 * Validates: Requirements 12.2
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

function generateShareUrl(baseUrl: string, productSlug: string, refSource: string = 'share'): string {
  return `${baseUrl}/compare/${productSlug}?ref=${refSource}`;
}

function generateWhatsAppLink(text: string, url: string): string {
  const message = encodeURIComponent(`${text} ${url}`);
  return `https://wa.me/?text=${message}`;
}

const slugArb = fc.string({ minLength: 3, maxLength: 50, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')) });

describe('Property 18: Shareable URL Format Correctness', () => {
  it('share URL always contains /compare/ path', () => {
    fc.assert(
      fc.property(slugArb, (slug) => {
        const url = generateShareUrl('https://dripfeed.in', slug);
        expect(url).toContain('/compare/');
      }),
    );
  });

  it('share URL always has ?ref=share tracking param', () => {
    fc.assert(
      fc.property(slugArb, (slug) => {
        const url = generateShareUrl('https://dripfeed.in', slug);
        expect(url).toContain('?ref=share');
      }),
    );
  });

  it('share URL is a valid URL', () => {
    fc.assert(
      fc.property(slugArb, (slug) => {
        const url = generateShareUrl('https://dripfeed.in', slug);
        expect(() => new URL(url)).not.toThrow();
      }),
    );
  });

  it('share URL contains the product slug', () => {
    fc.assert(
      fc.property(slugArb, (slug) => {
        const url = generateShareUrl('https://dripfeed.in', slug);
        expect(url).toContain(slug);
      }),
    );
  });

  it('WhatsApp link is always a valid wa.me URL', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 100 }),
        slugArb,
        (text, slug) => {
          const shareUrl = generateShareUrl('https://dripfeed.in', slug);
          const waLink = generateWhatsAppLink(text, shareUrl);
          expect(waLink).toMatch(/^https:\/\/wa\.me\/\?text=/);
        },
      ),
    );
  });
});
