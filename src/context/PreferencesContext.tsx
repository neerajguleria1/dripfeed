import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

export interface UserPreferences {
  categories: string[];
  brands: string[];
  priceRange: { min: number; max: number };
  occasions: string[];
  onboardingCompleted: boolean;
}

export interface PreferencesContextValue {
  preferences: UserPreferences | null;
  loading: boolean;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  clearPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch preferences on mount when user is authenticated
  useEffect(() => {
    if (!user) {
      setPreferences(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    api
      .get('/preferences')
      .then(({ data }) => {
        if (!cancelled) setPreferences(data);
      })
      .catch(() => {
        // Silently fail — preferences are non-critical
        if (!cancelled) setPreferences(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updatePreferences = useCallback(
    async (prefs: Partial<UserPreferences>) => {
      setLoading(true);
      try {
        const { data } = await api.put('/preferences', prefs);
        setPreferences(data);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearPreferences = useCallback(() => {
    setPreferences(null);
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ preferences, loading, updatePreferences, clearPreferences }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}

export default PreferencesProvider;
