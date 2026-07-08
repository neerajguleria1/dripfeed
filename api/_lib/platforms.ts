/**
 * Centralized platform marketplace configuration.
 * All platform-specific URLs and metadata in one place.
 */

export const PLATFORM_CONFIG = {
  amazon: {
    name: 'Amazon India',
    domain: 'https://www.amazon.in',
    searchUrl: (query: string) => `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
    color: '#FF9900',
  },
  flipkart: {
    name: 'Flipkart',
    domain: 'https://www.flipkart.com',
    searchUrl: (query: string) => `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
    color: '#2874F0',
  },
  myntra: {
    name: 'Myntra',
    domain: 'https://www.myntra.com',
    searchUrl: (query: string) => `https://www.myntra.com/${encodeURIComponent(query.replace(/\s+/g, '-'))}`,
    color: '#FF3F6C',
  },
  ajio: {
    name: 'Ajio',
    domain: 'https://www.ajio.com',
    searchUrl: (query: string) => `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`,
    color: '#3B3B3B',
  },
  meesho: {
    name: 'Meesho',
    domain: 'https://www.meesho.com',
    searchUrl: (query: string) => `https://www.meesho.com/search?q=${encodeURIComponent(query)}`,
    color: '#570741',
  },
  nykaa: {
    name: 'Nykaa Fashion',
    domain: 'https://www.nykaafashion.com',
    searchUrl: (query: string) => `https://www.nykaafashion.com/search/result/?q=${encodeURIComponent(query)}`,
    color: '#FC2779',
  },
  tatacliq: {
    name: 'Tata CLiQ',
    domain: 'https://www.tatacliq.com',
    searchUrl: (query: string) => `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(query)}`,
    color: '#6D3078',
  },
} as const;

export type PlatformKey = keyof typeof PLATFORM_CONFIG;

/**
 * Given a platform name and product title, returns a proper search URL.
 * Falls back to the raw domain if platform is unknown.
 */
export function getPlatformSearchUrl(platform: string, productTitle: string): string {
  const key = platform.toLowerCase().replace(/\s+/g, '') as string;

  for (const [id, config] of Object.entries(PLATFORM_CONFIG)) {
    if (key.includes(id)) {
      return config.searchUrl(productTitle);
    }
  }

  // Unknown platform — Google search fallback
  return `https://www.google.com/search?q=${encodeURIComponent(productTitle + ' buy online India')}`;
}
