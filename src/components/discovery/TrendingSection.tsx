import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TiltCard } from '../common/TiltCard';
import { ProductCard } from '../product/ProductCard';
import { ProductSkeleton } from '../ui/ProductSkeleton';
import { deckContainer, dealtCard } from '../../design-system/animations';
import type { ProductData } from '../../types/product';

export interface TrendingSectionProps {
  products: ProductData[];
  loading?: boolean;
}

export function TrendingSection({ products, loading = false }: TrendingSectionProps) {
  const navigate = useNavigate();

  return (
    <section className="px-6 sm:px-8 lg:px-16 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-[20px] sm:text-[24px] font-bold text-neutral-900 tracking-[-0.01em]">
            Trending Now
          </h2>
          <button
            onClick={() => navigate('/search')}
            className="text-[13px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1 transition-colors"
          >
            See All <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {loading ? (
          <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : (
          <motion.div
            variants={deckContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          >
            {products.slice(0, 8).map((product, i) => (
              <motion.div key={product.id || i} custom={i} variants={dealtCard}>
                <TiltCard>
                  <ProductCard product={product} />
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}

export default TrendingSection;
