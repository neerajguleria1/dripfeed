import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import ToastItem from '../components/ui/Toast';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

export interface ToastContextValue {
  toasts: Toast[];
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast: {
    success: () => {},
    error: () => {},
    info: () => {},
  },
  dismiss: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const MAX_VISIBLE = 3;

const DEFAULT_DURATIONS: Record<Toast['type'], number> = {
  success: 3000,
  error: 5000,
  info: 3000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = crypto.randomUUID();
    const duration = DEFAULT_DURATIONS[type];

    setToasts((prev) => {
      const next = [...prev, { id, message, type, duration }];
      // Keep at most MAX_VISIBLE — dismiss oldest if exceeded
      if (next.length > MAX_VISIBLE) {
        return next.slice(next.length - MAX_VISIBLE);
      }
      return next;
    });

    // Auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (message: string) => addToast(message, 'success'),
    error: (message: string) => addToast(message, 'error'),
    info: (message: string) => addToast(message, 'info'),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      {/* Toast container — fixed bottom-center */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none"
        style={{ zIndex: 'var(--df-z-toast, 300)' }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
