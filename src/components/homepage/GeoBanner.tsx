import { Globe, X } from 'lucide-react';

interface GeoBannerProps {
  /** Whether the user is detected as being in India */
  isIndia: boolean;
  /** Whether the user has previously dismissed the banner */
  dismissed: boolean;
  /** Callback to dismiss the banner (persists to localStorage via useGeoRegion) */
  onDismiss: () => void;
}

/**
 * Geo-awareness banner shown to non-India users.
 * Positioned inline between CategoryChips and ProductGrid.
 * Dismissible — once dismissed, the parent hook persists state in localStorage.
 *
 * Requirements validated: 9.1, 9.4, 9.5
 */
export default function GeoBanner({ isIndia, dismissed, onDismiss }: GeoBannerProps) {
  // Only render for non-India users who haven't dismissed
  if (isIndia || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 my-2 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
    >
      <Globe
        size={20}
        className="mt-0.5 flex-shrink-0 text-blue-600"
        aria-hidden="true"
      />

      <p className="flex-1 text-sm text-blue-800 leading-snug">
        TagCheck currently compares prices from Indian fashion platforms. Global
        platforms coming soon.
      </p>

      <button
        type="button"
        aria-label="Dismiss geo banner"
        onClick={onDismiss}
        className="
          flex-shrink-0 min-w-[44px] min-h-[44px]
          flex items-center justify-center
          -mr-2 -mt-1 rounded-md
          text-blue-600 hover:text-blue-800 hover:bg-blue-100
          transition-colors duration-150
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
        "
      >
        <X size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
