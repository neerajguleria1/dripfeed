/**
 * useGeoRegion.ts
 *
 * Determines the user's geographic region for content relevance.
 *
 * ── Primary source ────────────────────────────────────────────────────────────
 * Geo data from the /api/feed/home response (`x-vercel-ip-country` header,
 * resolved server-side). Passed in as the `geo` argument.
 *
 * ── Fallback heuristic ────────────────────────────────────────────────────────
 * When API geo data is unavailable, inspects `navigator.language` to infer
 * whether the user is likely outside India. Any locale starting with "hi" or
 * region subtag "IN" is treated as India.
 *
 * ── Dismissal persistence ─────────────────────────────────────────────────────
 * The geo banner dismissal is stored in localStorage under
 * `"tagcheck_geo_dismissed"` so repeat visitors don't see it again.
 * Handles private-browsing / quota-exceeded gracefully.
 *
 * Requirements validated: 9.1, 9.2, 9.5
 */

import { useState, useCallback, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Geo data shape from the /api/feed/home response */
export interface GeoData {
  country: string;
  isIndia: boolean;
}

export interface UseGeoRegionResult {
  /** ISO country code (e.g. "IN", "US") or null if undetermined */
  countryCode: string | null;
  /** Whether the user is detected as being in India */
  isIndia: boolean;
  /** Whether the user has dismissed the geo banner */
  dismissed: boolean;
  /** Dismiss the geo banner (persists to localStorage) */
  dismiss: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tagcheck_geo_dismissed';

// ─── localStorage helpers ─────────────────────────────────────────────────────

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // localStorage unavailable (private browsing, SecurityError)
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Quota exceeded or unavailable — non-fatal
  }
}

// ─── Fallback heuristic ───────────────────────────────────────────────────────

/**
 * Infer geo from navigator.language when API geo data is unavailable.
 * Returns { countryCode, isIndia }.
 *
 * Heuristic: treat Hindi locale ("hi") or any locale with region "IN"
 * (e.g. "en-IN", "hi-IN") as India. Everything else is non-India.
 */
function inferGeoFromLocale(): { countryCode: string | null; isIndia: boolean } {
  try {
    const lang = navigator.language || '';
    // navigator.language is typically "en-US", "hi-IN", "en-IN", "en", etc.
    const parts = lang.split('-');
    const langCode = parts[0]?.toLowerCase() ?? '';
    const regionCode = parts[1]?.toUpperCase() ?? null;

    // Explicit Indian region subtag
    if (regionCode === 'IN') {
      return { countryCode: 'IN', isIndia: true };
    }

    // Hindi language without explicit region — assume India
    if (langCode === 'hi') {
      return { countryCode: 'IN', isIndia: true };
    }

    // Non-India locale detected — use region if available
    return { countryCode: regionCode, isIndia: false };
  } catch {
    // navigator not available (SSR edge case) — default to India
    return { countryCode: 'IN', isIndia: true };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Determine user's geo region for homepage content relevance.
 *
 * @param geo - Optional geo data from the /api/feed/home response
 */
export function useGeoRegion(geo?: GeoData | null): UseGeoRegionResult {
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());

  const { countryCode, isIndia } = useMemo(() => {
    // Primary: use server-provided geo data
    if (geo) {
      return {
        countryCode: geo.country || null,
        isIndia: geo.isIndia,
      };
    }

    // Fallback: infer from browser locale
    return inferGeoFromLocale();
  }, [geo]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    writeDismissed();
  }, []);

  return { countryCode, isIndia, dismissed, dismiss };
}
