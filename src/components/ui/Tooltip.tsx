import { useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, DURATION } from '../../design-system/animations';

export interface TooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  delay?: number;
}

const positionClasses: Record<NonNullable<TooltipProps['position']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowClasses: Record<NonNullable<TooltipProps['position']>, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent border-4',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-x-transparent border-t-transparent border-4',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-y-transparent border-r-transparent border-4',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent border-4',
};

export function Tooltip({
  content,
  position = 'top',
  children,
  delay = 300,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      <AnimatePresence>
        {visible && (
          <motion.div
            className={[
              'absolute whitespace-nowrap pointer-events-none',
              positionClasses[position],
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ zIndex: 'var(--df-z-tooltip, 400)' }}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: DURATION.fast }}
          >
            <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg relative">
              {content}
              {/* Arrow */}
              <span
                className={['absolute w-0 h-0', arrowClasses[position]]
                  .filter(Boolean)
                  .join(' ')}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Tooltip;
