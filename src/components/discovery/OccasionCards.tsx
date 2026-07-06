import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { staggerChildren, staggerItem } from '../../design-system/animations';

interface Occasion {
  name: string;
  emoji: string;
  slug: string;
}

const OCCASIONS: Occasion[] = [
  { name: 'Wedding', emoji: '💒', slug: 'wedding' },
  { name: 'Festive', emoji: '🎊', slug: 'festive' },
  { name: 'Office', emoji: '👔', slug: 'office' },
  { name: 'Casual', emoji: '🌿', slug: 'casual' },
  { name: 'Party', emoji: '🎉', slug: 'party' },
  { name: 'Mehendi', emoji: '🌸', slug: 'mehendi' },
  { name: 'Sangeet', emoji: '💃', slug: 'sangeet' },
];

export function OccasionCards() {
  const navigate = useNavigate();

  return (
    <motion.section
      variants={staggerChildren}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      className="px-4 sm:px-6 lg:px-16 py-12"
    >
      <div className="max-w-6xl mx-auto">
        <motion.h2
          variants={staggerItem}
          className="text-xl sm:text-2xl font-bold text-[var(--df-accent-navy)] mb-6"
        >
          Shop by Occasion
        </motion.h2>
        <motion.div
          variants={staggerItem}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {OCCASIONS.map((occasion) => (
            <button
              key={occasion.slug}
              onClick={() => navigate(`/category/${occasion.slug}`)}
              className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-white shadow-sm border border-gray-100 rounded-full whitespace-nowrap hover:shadow-md hover:border-[var(--df-accent-gold-light)] transition-all duration-200 flex-shrink-0"
            >
              <span className="text-lg">{occasion.emoji}</span>
              <span className="text-sm font-medium text-[var(--df-accent-navy)]">
                {occasion.name}
              </span>
            </button>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

export default OccasionCards;
