import { Link } from 'react-router-dom';

type LogoVariant = 'light' | 'dark';

interface LogoProps {
  /** 'light' = white wordmark for dark hero backgrounds. 'dark' = navy wordmark for white headers. */
  variant?: LogoVariant;
  /** Optional size scale, defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** Render as a static span instead of a Link (e.g. inside an already-clickable wrapper). */
  asLink?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: 20, text: 'text-base', gap: 'gap-1.5' },
  md: { icon: 24, text: 'text-lg', gap: 'gap-2' },
  lg: { icon: 30, text: 'text-2xl', gap: 'gap-2.5' },
};

/**
 * DripFeed logo mark: a minimal geometric droplet trail icon paired with a
 * clean sans-serif wordmark. Single-weight, single-color wordmark (no split
 * coloring, no serif) for a modern, durable brand feel across both dark
 * hero surfaces and white headers.
 */
export default function Logo({ variant = 'dark', size = 'md', asLink = true, className = '' }: LogoProps) {
  const { icon, text, gap } = sizeMap[size];
  const textColor = variant === 'light' ? 'text-white' : 'text-[#0F0F1A]';

  const content = (
    <span className={`inline-flex items-center ${gap} ${className}`}>
      <DropletMark size={icon} />
      <span
        className={`font-bold tracking-tight leading-none whitespace-nowrap ${text} ${textColor}`}
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        DripFeed
      </span>
    </span>
  );

  if (!asLink) return content;

  return (
    <Link to="/" className="flex-shrink-0 inline-flex items-center focus:outline-none" aria-label="DripFeed home">
      {content}
    </Link>
  );
}

/** Abstract droplet-trail mark: three descending, overlapping rounded forms in the gold accent. */
function DropletMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <circle cx="16" cy="7.5" r="3.5" fill="#C9A96E" opacity="0.55" />
      <circle cx="16" cy="17" r="5.5" fill="#C9A96E" opacity="0.8" />
      <path
        d="M16 15c3.6 3.4 6.5 6.4 6.5 9.3a6.5 6.5 0 11-13 0c0-2.9 2.9-5.9 6.5-9.3z"
        fill="#C9A96E"
      />
    </svg>
  );
}
