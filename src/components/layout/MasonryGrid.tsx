import type { ReactNode } from 'react';

export interface MasonryGridProps {
  children: ReactNode;
  columns?: { mobile: number; tablet: number; desktop: number };
  gap?: { mobile: number; desktop: number };
}

/**
 * Responsive masonry layout using CSS `columns` for true top-to-bottom
 * card distribution. Each child is wrapped to prevent column breaks.
 *
 * Breakpoints:
 *  - mobile: <768px
 *  - tablet: 768px–1023px
 *  - desktop: ≥1024px
 *
 * Default columns: mobile(2), tablet(3), desktop(4)
 * Default gap: mobile(8px), desktop(12px) with 768px breakpoint
 */
export function MasonryGrid({
  children,
  columns = { mobile: 2, tablet: 3, desktop: 4 },
  gap = { mobile: 8, desktop: 12 },
}: MasonryGridProps) {
  return (
    <div
      className="masonry-grid"
      style={
        {
          '--masonry-cols-mobile': columns.mobile,
          '--masonry-cols-tablet': columns.tablet,
          '--masonry-cols-desktop': columns.desktop,
          '--masonry-gap-mobile': `${gap.mobile}px`,
          '--masonry-gap-desktop': `${gap.desktop}px`,
        } as React.CSSProperties
      }
    >
      <style>{`
        .masonry-grid {
          columns: var(--masonry-cols-mobile);
          column-gap: var(--masonry-gap-mobile);
        }

        .masonry-grid > * {
          break-inside: avoid;
          margin-bottom: var(--masonry-gap-mobile);
          display: inline-block;
          width: 100%;
        }

        @media (min-width: 768px) {
          .masonry-grid {
            columns: var(--masonry-cols-tablet);
            column-gap: var(--masonry-gap-desktop);
          }

          .masonry-grid > * {
            margin-bottom: var(--masonry-gap-desktop);
          }
        }

        @media (min-width: 1024px) {
          .masonry-grid {
            columns: var(--masonry-cols-desktop);
          }
        }
      `}</style>
      {children}
    </div>
  );
}

export default MasonryGrid;
