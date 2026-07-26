import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { slideDown } from '../../design-system/animations';

/** Inline online/offline detection — OnlineContext was removed as dead code. */
function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return isOnline;
}

export function OfflineBanner() {
  const isOnline = useIsOnline();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          variants={slideDown}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed top-14 md:top-16 left-0 right-0 z-[90] bg-amber-50 border-b border-amber-200 px-4 py-2"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-amber-800">
            <WifiOff className="w-4 h-4" />
            <span>You're offline — some features may be unavailable</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OfflineBanner;
