import { useState, useCallback } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { ASCIBadge } from './ASCIBadge';

export interface AffiliateButtonProps {
  platform: string;
  url: string;
  productTitle: string;
  fullWidth?: boolean;
  className?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  amazon: '#FF9900',
  flipkart: '#2874F0',
  myntra: '#FF3F6C',
  ajio: '#3B3B3B',
  meesho: '#570741',
  nykaa: '#FC2779',
  'tata cliq': '#6D3078',
  bewakoof: '#FDD835',
  shein: '#000000',
};

/** Centralized platform search URLs — single source of truth */
const PLATFORM_SEARCH_URLS: Record<string, (q: string) => string> = {
  amazon: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  flipkart: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  myntra: (q) => `https://www.myntra.com/${encodeURIComponent(q.replace(/\s+/g, '-'))}`,
  ajio: (q) => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`,
  meesho: (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,
  nykaa: (q) => `https://www.nykaafashion.com/search/result/?q=${encodeURIComponent(q)}`,
  tatacliq: (q) => `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(q)}`,
};

/**
 * If the URL is just a bare domain (no product path), build a proper search URL.
 * This fixes the bug where seed data only has "https://www.amazon.in" — user would
 * land on the homepage with nothing relevant.
 */
function resolveProductUrl(platform: string, url: string, productTitle: string): string {
  try {
    const parsed = new URL(url);
    // If the path is empty or just "/" — it's a bare domain, build a search URL instead
    if (parsed.pathname === '/' || parsed.pathname === '') {
      const key = platform.toLowerCase().replace(/\s+/g, '');
      for (const [name, builder] of Object.entries(PLATFORM_SEARCH_URLS)) {
        if (key.includes(name)) return builder(productTitle);
      }
    }
  } catch {
    // Invalid URL — fall through
  }
  return url;
}

function getPlatformColor(platform: string): string {
  const key = platform.toLowerCase();
  for (const [name, color] of Object.entries(PLATFORM_COLORS)) {
    if (key.includes(name)) return color;
  }
  return '#1a1a2e';
}

function getPlatformTextColor(platform: string): string {
  const dark = ['bewakoof'];
  const key = platform.toLowerCase();
  for (const name of dark) {
    if (key.includes(name)) return '#000000';
  }
  return '#ffffff';
}

type ButtonState = 'default' | 'loading' | 'redirecting';

export function AffiliateButton({
  platform,
  url,
  productTitle,
  fullWidth = false,
  className = '',
}: AffiliateButtonProps) {
  const [state, setState] = useState<ButtonState>('default');

  const handleClick = useCallback(async () => {
    if (state !== 'default') return;

    const resolvedUrl = resolveProductUrl(platform, url, productTitle);
    setState('loading');

    try {
      const { data } = await api.post('/affiliate/redirect', {
        platform,
        productUrl: resolvedUrl,
        productName: productTitle,
        device: /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'web',
        sessionId: sessionStorage.getItem('sessionId') || undefined,
      });

      const affiliateUrl = data?.affiliateUrl || resolvedUrl;

      setState('redirecting');
      setTimeout(() => {
        window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
        setState('default');
      }, 500);
    } catch {
      // Never fail — open resolved URL directly
      setState('redirecting');
      setTimeout(() => {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
        setState('default');
      }, 500);
    }
  }, [state, platform, url, productTitle]);

  const bgColor = getPlatformColor(platform);
  const textColor = getPlatformTextColor(platform);

  const buttonLabel =
    state === 'loading'
      ? 'Loading...'
      : state === 'redirecting'
        ? `Opening ${platform}...`
        : `Buy on ${platform}`;

  return (
    <div className={`inline-flex items-center gap-2 ${fullWidth ? 'w-full' : ''} ${className}`}>
      <button
        onClick={handleClick}
        disabled={state !== 'default'}
        className={`
          inline-flex items-center justify-center gap-2
          px-5 py-3 rounded-lg font-medium text-sm
          transition-all duration-200
          hover:opacity-90 active:scale-[0.98]
          disabled:opacity-70 disabled:cursor-not-allowed
          min-h-[48px]
          ${fullWidth ? 'w-full' : ''}
        `}
        style={{ backgroundColor: bgColor, color: textColor }}
        aria-label={`Buy ${productTitle} on ${platform}`}
      >
        {state === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ExternalLink className="w-4 h-4" />
        )}
        <span>{buttonLabel}</span>
      </button>
      <ASCIBadge />
    </div>
  );
}

export default AffiliateButton;
