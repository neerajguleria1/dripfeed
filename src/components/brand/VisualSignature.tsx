import { motion } from 'framer-motion';

export interface VisualSignatureProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export function VisualSignature({
  size = 40,
  className = '',
  animated = true,
}: VisualSignatureProps) {
  const dripDrop = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M20 2C20 2 8 16 8 25.5C8 32.404 13.373 38 20 38C26.627 38 32 32.404 32 25.5C32 16 20 2 20 2Z"
        fill="currentColor"
      />
      <path
        d="M20 8C20 8 12 18 12 25C12 29.418 15.582 33 20 33C24.418 33 28 29.418 28 25C28 18 20 8 20 8Z"
        fill="var(--df-bg-warm, #F8F5F2)"
      />
    </svg>
  );

  if (!animated) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[var(--df-accent-navy)] ${className}`}
      >
        {dripDrop}
      </span>
    );
  }

  return (
    <motion.span
      className={`inline-flex items-center justify-center text-[var(--df-accent-navy)] ${className}`}
      animate={{
        scale: [1, 1.08, 1],
      }}
      transition={{
        duration: 2.5,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatDelay: 1,
      }}
    >
      {dripDrop}
    </motion.span>
  );
}

export default VisualSignature;
