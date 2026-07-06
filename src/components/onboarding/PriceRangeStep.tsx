import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { staggerChildren, staggerItem } from '../../design-system/animations';

const PRICE_OPTIONS = [
  { id: 'budget', label: 'Budget', price: 'Under ₹500', description: 'Everyday essentials', range: { min: 0, max: 500 } },
  { id: 'mid', label: 'Mid-range', price: '₹500 – ₹2,000', description: 'Quality pieces', range: { min: 500, max: 2000 } },
  { id: 'premium', label: 'Premium', price: '₹2,000 – ₹5,000', description: 'Premium brands', range: { min: 2000, max: 5000 } },
  { id: 'luxury', label: 'Luxury', price: '₹5,000+', description: 'Designer & luxury', range: { min: 5000, max: 100000 } },
];

export interface PriceRangeStepProps {
  range: { min: number; max: number };
  onRangeChange: (range: { min: number; max: number }) => void;
}

export function PriceRangeStep({ range, onRangeChange }: PriceRangeStepProps) {
  function isSelected(optionRange: { min: number; max: number }) {
    return range.min === optionRange.min && range.max === optionRange.max;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-[#051F45] mb-2">What's your budget?</h3>
      <p className="text-sm text-gray-500 mb-6">Pick your usual shopping range</p>

      <motion.div
        className="grid grid-cols-2 gap-3"
        variants={staggerChildren}
        initial="hidden"
        animate="visible"
      >
        {PRICE_OPTIONS.map((option) => {
          const active = isSelected(option.range);
          return (
            <motion.button
              key={option.id}
              type="button"
              variants={staggerItem}
              onClick={() => onRangeChange(option.range)}
              className={[
                'relative p-4 rounded-xl border-2 text-left transition-all duration-200',
                active
                  ? 'border-[#051F45] bg-[#051F45]/5'
                  : 'border-gray-200 hover:border-gray-300 bg-white',
              ].join(' ')}
            >
              {active && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-[#051F45] rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <p className="font-semibold text-[#051F45] text-sm">{option.label}</p>
              <p className="text-xs text-gray-500 mt-1">{option.price}</p>
              <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

export default PriceRangeStep;
