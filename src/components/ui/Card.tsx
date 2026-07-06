import type { ReactNode, KeyboardEvent } from 'react';

export interface CardProps {
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

const variantClasses: Record<NonNullable<CardProps['variant']>, string> = {
  elevated: 'bg-white shadow-md rounded-xl',
  outlined: 'bg-white border border-gray-200 rounded-xl',
  flat: 'bg-gray-50 rounded-xl',
};

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  variant = 'elevated',
  padding = 'md',
  hover = false,
  children,
  className = '',
  onClick,
}: CardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={[
        variantClasses[variant],
        paddingClasses[padding],
        hover
          ? 'transition-all duration-250 ease-out hover:scale-[1.02] hover:shadow-lg'
          : '',
        onClick ? 'cursor-pointer' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

export default Card;
