import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { staggerChildren, staggerItem } from '../../design-system/animations';

const CATEGORIES = [
  { id: 'ethnic-wear', label: 'Ethnic Wear', emoji: '🪔' },
  { id: 'western', label: 'Western', emoji: '👗' },
  { id: 'footwear', label: 'Footwear', emoji: '👟' },
  { id: 'accessories', label: 'Accessories', emoji: '💍' },
  { id: 'fusion-wear', label: 'Fusion Wear', emoji: '✨' },
  { id: 'activewear', label: 'Activewear', emoji: '🏃' },
  { id: 'luxury', label: 'Luxury', emoji: '💎' },
];

export interface CategoryStepProps {
  selected: string[];
  onSelect: (categories: string[]) => void;
}

export function CategoryStep({ selected, onSelect }: CategoryStepProps) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onSelect(selected.filter((s) => s !== id));
    } else {
      onSelect([...selected, id]);
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-[#051F45] mb-2">What do you shop for?</h3>
      <p className="text-sm text-gray-500 mb-6">Select all that interest you</p>

      <motion.div
        className="grid grid-cols-2 gap-3 md:grid-cols-3"
        variants={staggerChildren}
        initial="hidden"
        animate="visible"
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selected.includes(cat.id);
          return (
            <motion.button
              key={cat.id}
              type="button"
              variants={staggerItem}
              onClick={() => toggle(cat.id)}
              className={[
                'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                isSelected
                  ? 'border-[#051F45] bg-[#051F45]/5'
                  : 'border-gray-200 hover:border-gray-300 bg-white',
              ].join(' ')}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#051F45] rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <span className="text-2xl">{cat.emoji}</span>
              <span className="text-xs font-medium text-[#051F45]">{cat.label}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

export default CategoryStep;
