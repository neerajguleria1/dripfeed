import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import type { ProductData } from '../../types/product';

export interface SaveButtonProps {
  productTitle: string;
  productData?: Partial<ProductData>;
  onSaved?: () => void;
  className?: string;
}

const blushPink = '#C9A96E';

const dripVariants = {
  initial: { y: -8, opacity: 0, scale: 0.4 },
  animate: {
    y: 16,
    opacity: [1, 1, 0],
    scale: [0.4, 1, 0.6],
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
  exit: { opacity: 0, scale: 0 },
};

export function SaveButton({
  productTitle,
  productData,
  onSaved,
  className = '',
}: SaveButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<'default' | 'saving' | 'saved'>('default');
  const [showDrip, setShowDrip] = useState(false);
  const savedFlashRef = useRef(true);

  async function handleClick() {
    if (!user) {
      navigate('/login');
      return;
    }
    if (state === 'saving' || state === 'saved') return;

    setState('saving');
    try {
      await api.post('/wishlist', {
        productTitle,
        imageUrl: productData?.imageUrl,
        brand: productData?.brand,
        savedPrice: productData?.price,
        platform: productData?.platform,
        sourceUrl: productData?.url,
      });
      setState('saved');
      if (savedFlashRef.current) {
        setShowDrip(true);
        setTimeout(() => setShowDrip(false), 700);
      }
      onSaved?.();
    } catch {
      setState('saved');
    }
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <AnimatePresence>
        {showDrip && (
          <motion.span
            key="drip"
            variants={dripVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            <svg width="8" height="12" viewBox="0 0 8 12" fill="none" aria-hidden="true">
              <path
                d="M4 0C4 0 1 5 1 7.5C1 9.433 2.343 11 4 11C5.657 11 7 9.433 7 7.5C7 5 4 0 4 0Z"
                fill={blushPink}
              />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleClick}
        disabled={state === 'saving'}
        aria-label={state === 'saved' ? 'Saved to wishlist' : 'Save to wishlist'}
        whileTap={state !== 'saved' ? { scale: 0.9 } : undefined}
        className={[
          'inline-flex items-center justify-center w-10 h-10 rounded-full',
          'border transition-colors duration-200',
          state === 'saved'
            ? 'bg-[var(--df-accent-navy)] border-[var(--df-accent-navy)] shadow-sm'
            : 'bg-white/90 border-gray-200 hover:bg-white shadow-sm',
          'disabled:opacity-70',
        ].join(' ')}
      >
        {state === 'saving' ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        ) : (
          <motion.div
            key={state}
            initial={state === 'saved' ? { scale: 0.4 } : false}
            animate={state === 'saved' ? { scale: [0.4, 1.3, 1] } : {}}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <Heart
              className={[
                'w-5 h-5 transition-colors duration-200',
                state === 'saved' ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-gray-400',
              ].join(' ')}
            />
          </motion.div>
        )}
      </motion.button>
    </div>
  );
}

export default SaveButton;

