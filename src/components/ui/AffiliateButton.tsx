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

    setState('loading');

    try {
      const { data } = await api.post('/affiliate/redirect', {
        platform,
        productUrl: url,
        productName: productTitle,
        device: /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'web',
        sessionId: sessionStorage.getItem('sessionId') || undefined,
      });

      const affiliateUrl = data?.affiliateUrl || url;

      setState('redirecting');
      setTimeout(() => {
        window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
        setState('default');
      }, 500);
    } catch {
      // Never fail — open original URL directly
      setState('redirecting');
      setTimeout(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
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
