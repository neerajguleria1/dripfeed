export type Platform =
  | 'myntra'
  | 'ajio'
  | 'amazon'
  | 'flipkart'
  | 'nykaa'
  | 'meesho'
  | 'bewakoof'
  | 'shein'
  | 'tatacliq';

export interface PlatformBadgeProps {
  platform: Platform | string;
  size?: 'sm' | 'md';
  showName?: boolean;
  className?: string;
}

interface PlatformConfig {
  label: string;
  color: string;
  textColor: string;
}

const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  myntra: { label: 'Myntra', color: '#FF3F6C', textColor: 'white' },
  ajio: { label: 'Ajio', color: '#000000', textColor: 'white' },
  amazon: { label: 'Amazon', color: '#FF9900', textColor: 'black' },
  flipkart: { label: 'Flipkart', color: '#2874F0', textColor: 'white' },
  nykaa: { label: 'Nykaa', color: '#FC2779', textColor: 'white' },
  meesho: { label: 'Meesho', color: '#570A57', textColor: 'white' },
  bewakoof: { label: 'Bewakoof', color: '#FDD835', textColor: 'black' },
  shein: { label: 'Shein', color: '#000000', textColor: 'white' },
  tatacliq: { label: 'Tata CLiQ', color: '#1F2937', textColor: 'white' },
};

const sizeClasses: Record<NonNullable<PlatformBadgeProps['size']>, string> = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
};

export function PlatformBadge({
  platform,
  size = 'sm',
  showName = true,
  className = '',
}: PlatformBadgeProps) {
  const key = platform.toLowerCase() as Platform;
  const config = PLATFORM_CONFIG[key];

  // Fallback for unknown platforms
  if (!config) {
    const label = platform.charAt(0).toUpperCase() + platform.slice(1);

    if (!showName) {
      return (
        <span
          className={[
            'inline-block rounded-full w-2.5 h-2.5 bg-gray-400',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label={label}
        />
      );
    }

    return (
      <span
        className={[
          'inline-flex items-center rounded-full font-medium bg-gray-200 text-gray-700',
          sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {label}
      </span>
    );
  }

  if (!showName) {
    return (
      <span
        style={{ backgroundColor: config.color, color: config.textColor }}
        className={[
          'inline-flex items-center justify-center rounded-full w-5 h-5 text-[10px] font-bold',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={config.label}
      >
        {config.label.charAt(0)}
      </span>
    );
  }

  return (
    <span
      style={{ backgroundColor: config.color, color: config.textColor }}
      className={[
        'inline-flex items-center rounded-full font-medium',
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {config.label}
    </span>
  );
}

export default PlatformBadge;
