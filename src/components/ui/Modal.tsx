import { useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { modalOverlay, modalContent } from '../../design-system/animations';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  children: ReactNode;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm w-full',
  md: 'max-w-md w-full',
  lg: 'max-w-lg w-full',
  fullscreen: 'inset-4 max-w-4xl w-full md:inset-auto',
};

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 'var(--df-z-modal, 200)' }}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Content */}
          <motion.div
            className={[
              'relative bg-white rounded-xl shadow-xl p-6',
              sizeClasses[size],
            ]
              .filter(Boolean)
              .join(' ')}
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title */}
            {title && (
              <h2
                id="modal-title"
                className="text-xl font-semibold text-gray-900 mb-4 pr-8"
              >
                {title}
              </h2>
            )}

            {/* Body */}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default Modal;
