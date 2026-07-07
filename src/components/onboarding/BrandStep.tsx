import { motion } from 'framer-motion';
import { staggerChildren, staggerItem } from '../../design-system/animations';

const BRANDS = [
  'HRX',
  'Roadster',
  'Anouk',
  'Biba',
  'Bewakoof',
  'Snitch',
  'Libas',
  'The Souled Store',
  'Allen Solly',
  'Van Heusen',
  'Fabindia',
  'Global Desi',
  'W for Women',
  'H&M',
  'Zara',
];

export interface BrandStepProps {
  selected: string[];
  onSelect: (brands: string[]) => void;
}

export function BrandStep({ selected, onSelect }: BrandStepProps) {
  function toggle(brand: string) {
    if (selected.includes(brand)) {
      onSelect(selected.filter((s) => s !== brand));
    } else {
      onSelect([...selected, brand]);
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-[#0F0F1A] mb-2">Your favourite brands</h3>
      <p className="text-sm text-gray-500 mb-6">Pick brands you love — we'll prioritise them</p>

      <motion.div
        className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5"
        variants={staggerChildren}
        initial="hidden"
        animate="visible"
      >
        {BRANDS.map((brand) => {
          const isSelected = selected.includes(brand);
          return (
            <motion.button
              key={brand}
              type="button"
              variants={staggerItem}
              onClick={() => toggle(brand)}
              className={[
                'px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all duration-200 text-center',
                isSelected
                  ? 'bg-[#0F0F1A] text-white border-[#0F0F1A]'
                  : 'bg-white text-[#0F0F1A] border-gray-200 hover:border-gray-300',
              ].join(' ')}
            >
              {brand}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

export default BrandStep;

