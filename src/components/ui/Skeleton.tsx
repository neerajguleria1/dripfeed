export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

function getWidthStyle(width: string | number | undefined): string | undefined {
  if (width === undefined) return undefined;
  return typeof width === 'number' ? `${width}px` : width;
}

function getHeightStyle(height: string | number | undefined): string | undefined {
  if (height === undefined) return undefined;
  return typeof height === 'number' ? `${height}px` : height;
}

function TextSkeleton({ count = 1, width, className = '' }: SkeletonProps) {
  const widthPattern = ['100%', '80%', '60%'];

  return (
    <div className={['flex flex-col gap-2', className].filter(Boolean).join(' ')}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-4 rounded skeleton"
          style={{ width: width ? getWidthStyle(width) : widthPattern[i % widthPattern.length] }}
        />
      ))}
    </div>
  );
}

function CircularSkeleton({ width, height, className = '' }: SkeletonProps) {
  const size = getWidthStyle(width) || getHeightStyle(height) || '40px';

  return (
    <div
      className={['rounded-full skeleton', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    />
  );
}

function RectangularSkeleton({ width, height, className = '' }: SkeletonProps) {
  return (
    <div
      className={['rounded-lg skeleton', className].filter(Boolean).join(' ')}
      style={{
        width: getWidthStyle(width) || '100%',
        height: getHeightStyle(height) || '100px',
      }}
    />
  );
}

function CardSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={[
        'bg-white rounded-xl overflow-hidden border border-gray-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Image area */}
      <div className="h-40 skeleton" />

      {/* Content area */}
      <div className="p-4 flex flex-col gap-3">
        {/* Title lines */}
        <div className="h-4 w-full rounded skeleton" />
        <div className="h-4 w-4/5 rounded skeleton" />
        <div className="h-4 w-3/5 rounded skeleton" />

        {/* Badge area */}
        <div className="flex gap-2 mt-1">
          <div className="h-6 w-16 rounded-full skeleton" />
          <div className="h-6 w-12 rounded-full skeleton" />
        </div>
      </div>
    </div>
  );
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  count,
  className,
}: SkeletonProps) {
  const props = { width, height, count, className };

  switch (variant) {
    case 'text':
      return <TextSkeleton {...props} />;
    case 'circular':
      return <CircularSkeleton {...props} />;
    case 'rectangular':
      return <RectangularSkeleton {...props} />;
    case 'card':
      return <CardSkeleton {...props} />;
    default:
      return <TextSkeleton {...props} />;
  }
}

export default Skeleton;
