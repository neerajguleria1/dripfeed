import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { toastVariants } from '../../design-system/animations';
import type { Toast } from '../../context/ToastContext';

export interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const accentColors: Record<Toast['type'], string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

const icons: Record<Toast['type'], React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />,
  error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
};

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="pointer-events-auto flex items-stretch bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden min-w-[280px] max-w-sm"
    >
      {/* Left color accent bar */}
      <div className={['w-1 shrink-0', accentColors[toast.type]].join(' ')} />

      {/* Content */}
      <div className="flex items-center gap-3 px-3 py-3 flex-1">
        {icons[toast.type]}
        <p className="text-sm text-gray-800 flex-1">{toast.message}</p>

        {/* Close button */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          aria-label="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

export default ToastItem;
