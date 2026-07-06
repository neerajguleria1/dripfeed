import { motion } from 'framer-motion';

interface DripDividerProps {
  className?: string;
}

export function DripDivider({ className = '' }: DripDividerProps) {
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      <motion.span
        className="block w-1 h-1 rounded-full bg-[var(--df-accent-gold)]"
        animate={{ scale: [1, 1.6, 1] }}
        transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, delay: 0 }}
      />
      <motion.span
        className="block w-1 h-1 rounded-full bg-[var(--df-accent-gold)]"
        animate={{ scale: [1, 1.6, 1] }}
        transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, delay: 0.3 }}
      />
      <motion.span
        className="block w-1 h-1 rounded-full bg-[var(--df-accent-gold)]"
        animate={{ scale: [1, 1.6, 1] }}
        transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, delay: 0.6 }}
      />
    </div>
  );
}

export default DripDivider;
