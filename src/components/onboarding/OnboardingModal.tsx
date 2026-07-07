import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CategoryStep } from './CategoryStep';
import { BrandStep } from './BrandStep';
import { PriceRangeStep } from './PriceRangeStep';
import { usePreferences } from '../../context/PreferencesContext';
import { DURATION } from '../../design-system/animations';

export interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TOTAL_STEPS = 3;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1, transition: { duration: DURATION.normal } },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
    transition: { duration: DURATION.fast },
  }),
};

export function OnboardingModal({ open, onClose, onComplete }: OnboardingModalProps) {
  const { updatePreferences } = usePreferences();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Form data
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 10000 });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function goNext() {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  }

  function goBack() {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  }

  async function handleComplete() {
    setSaving(true);
    try {
      await updatePreferences({
        categories,
        brands,
        priceRange,
        onboardingCompleted: true,
      });
      onComplete();
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    onClose();
  }

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <Modal open={open} onClose={onClose} size={isMobile ? 'fullscreen' : 'lg'}>
      <div className="min-h-[380px] flex flex-col">
        {/* Progress indicator dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={[
                'h-2.5 rounded-full transition-all duration-200',
                i === step ? 'bg-[#0F0F1A] w-6' : 'bg-gray-200 w-2.5',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Step content with slide animation */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {step === 0 && <CategoryStep selected={categories} onSelect={setCategories} />}
              {step === 1 && <BrandStep selected={brands} onSelect={setBrands} />}
              {step === 2 && <PriceRangeStep range={priceRange} onRangeChange={setPriceRange} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={goBack}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={handleComplete} loading={saving}>
                Complete
              </Button>
            ) : (
              <Button size="sm" onClick={goNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default OnboardingModal;

