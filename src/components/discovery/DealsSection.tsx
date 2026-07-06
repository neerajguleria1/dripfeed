import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PlatformBadge from '../ui/PlatformBadge';
import PriceDisplay from '../ui/PriceDisplay';
import DiscountBadge from '../ui/DiscountBadge';
import { staggerChildren, staggerItem } from '../../design-system/animations';
import type { DealData } from '../../types/product';

export interface DealsSectionProps {
  deals: DealData[];
  loading?: boolean;
}

function DealCard({ deal }: { deal: DealData }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/compare?q=${encodeURIComponent(deal.title)}`)}
      className="min-w-[240px] sm:min-w-[280px] snap-start bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200 flex-shrink-0"
    >
      <div className="relative h-40 bg-[var(--df-bg-warm)] overflow-hidden">
        {deal.imageUrl ? (
          <img
            src={deal.imageUrl}
            alt={deal.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">
            🏷️
          </div>
        )}
        <div className="absolute top-2 right-2">
          <PlatformBadge platform={deal.platform} size="sm" />
        </div>
        {deal.discount > 0 && (
          <div className="absolute bottom-2 left-2">
            <DiscountBadge percentage={deal.discount} size="sm" />
          </div>
        )}
      </div>
      <div className="p-3">
        {deal.brand && (
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">
            {deal.brand}
          </p>
        )}
        <p className="text-sm font-medium text-[var(--df-accent-navy)] line-clamp-1">
          {deal.title}
        </p>
        <div className="mt-2">
          <PriceDisplay price={deal.price} originalPrice={deal.originalPrice} size="sm" />
        </div>
      </div>
    </div>
  );
}

function DealSkeleton() {
  return (
    <div className="min-w-[240px] sm:min-w-[280px] snap-start bg-white/60 rounded-xl border border-gray-100 overflow-hidden flex-shrink-0">
      <div className="h-40 skeleton" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 w-16 skeleton rounded" />
        <div className="h-4 w-full skeleton rounded" />
        <div className="h-5 w-24 skeleton rounded" />
      </div>
    </div>
  );
}

export function DealsSection({ deals, loading = false }: DealsSectionProps) {
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
        <motion.div variants={staggerItem} className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--df-accent-navy)]">
            Deals of the Day 💸
          </h2>
          <button
            onClick={() => navigate('/search?q=deals')}
            className="text-sm text-[var(--df-accent-navy)]/60 hover:text-[var(--df-accent-navy)] flex items-center gap-1 transition-colors"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
        <motion.div
          variants={staggerItem}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <DealSkeleton key={i} />)
            : deals.slice(0, 6).map((deal, i) => <DealCard key={deal.id || i} deal={deal} />)}
        </motion.div>
      </div>
    </motion.section>
  );
}

export default DealsSection;
