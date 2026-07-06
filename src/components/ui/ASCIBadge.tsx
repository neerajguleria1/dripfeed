export interface ASCIBadgeProps {
  className?: string;
}

/**
 * ASCI disclosure badge — small pill indicating affiliate link.
 * Always visible with minimum 12px font and contrasting color.
 */
export function ASCIBadge({ className = '' }: ASCIBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 font-medium select-none ${className}`}
      style={{ fontSize: '12px', lineHeight: '16px', minHeight: '18px' }}
      aria-label="This is an affiliate link"
    >
      #Ad
    </span>
  );
}

export default ASCIBadge;
