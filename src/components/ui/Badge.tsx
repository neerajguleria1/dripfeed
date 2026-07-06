import type { ReactNode } from 'react';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'platform' | 'discount';
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-50 text-green-600',
  error: 'bg-red-50 text-red-600',
  warning: 'bg-amber-50 text-amber-600',
  platform: 'bg-gray-100 text-gray-700',
  discount: 'bg-error text-white font-bold',
};

const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-0.5',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

export default Badge;
