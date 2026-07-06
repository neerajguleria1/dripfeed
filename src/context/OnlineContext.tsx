import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface OnlineContextValue {
  isOnline: boolean;
}

const OnlineContext = createContext<OnlineContextValue>({ isOnline: true });

export function OnlineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <OnlineContext.Provider value={{ isOnline }}>
      {children}
    </OnlineContext.Provider>
  );
}

export function useOnline(): OnlineContextValue {
  return useContext(OnlineContext);
}

export default OnlineProvider;
