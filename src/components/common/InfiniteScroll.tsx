import { useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface InfiniteScrollProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  children: ReactNode;
  loader?: ReactNode;
}

function DefaultLoader() {
  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {[1, 2].map((i) => (
        <div key={i} className="animate-pulse space-y-3">
          <div className="h-40 bg-gray-200 rounded-lg" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function InfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
  children,
  loader,
}: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: '200px',
      threshold: 0,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  return (
    <div>
      {children}
      {loading && (loader || <DefaultLoader />)}
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
    </div>
  );
}

export default InfiniteScroll;
