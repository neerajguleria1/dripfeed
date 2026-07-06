import { ProductCard } from './ProductCard';
import { ProductSkeleton } from '../ui/ProductSkeleton';
import type { ProductData } from '../../types/product';

export interface ProductGridProps {
  products: ProductData[];
  loading?: boolean;
  columns?: 2 | 3 | 4;
  className?: string;
}

const gridColsClass: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
};

export function ProductGrid({
  products,
  loading = false,
  columns = 4,
  className = '',
}: ProductGridProps) {
  const skeletonCount = columns * 2;

  if (loading) {
    return (
      <div className={['grid gap-5', gridColsClass[columns], className].filter(Boolean).join(' ')}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={['grid gap-5', gridColsClass[columns], className].filter(Boolean).join(' ')}>
      {products.map((product, i) => (
        <ProductCard key={product.id || i} product={product} />
      ))}
    </div>
  );
}

export default ProductGrid;
