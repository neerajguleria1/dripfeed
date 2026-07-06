import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const dropVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: (i: number) => ({
    height: '100%',
    opacity: [0.8, 0.6, 0.4],
    transition: {
      height: {
        duration: 0.8,
        delay: 0.3 + i * 0.12,
        ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
      },
      opacity: {
        duration: 1.2,
        delay: 0.3 + i * 0.12,
      },
    },
  }),
};

const pulseVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

export interface DripSignatureProps {
  className?: string;
}

export function DripSignature({ className = '' }: DripSignatureProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const drops = [
    { height: 48, width: 3, left: 8 },
    { height: 64, width: 2.5, left: 20 },
    { height: 36, width: 4, left: 34 },
    { height: 56, width: 2, left: 48 },
    { height: 72, width: 3.5, left: 62 },
    { height: 40, width: 2, left: 76 },
    { height: 52, width: 3, left: 88 },
  ];

  return (
    <div ref={ref} className={`relative select-none ${className}`}>
      <motion.div
        variants={pulseVariants}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        className="relative inline-flex items-center justify-center"
      >
        <span
          className="text-4xl sm:text-5xl font-bold tracking-tight"
          style={{ fontFamily: "'Lobster Two', cursive", color: '#1A1A2E' }}
        >
          DripFeed
        </span>

        <svg
          className="absolute -bottom-1 left-0 w-full"
          viewBox="0 0 120 8"
          fill="none"
          preserveAspectRatio="none"
          style={{ height: 6 }}
        >
          <motion.path
            d="M2 6 Q 30 0 60 6 Q 90 12 118 6"
            stroke="#C9A96E"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={
              isInView
                ? { pathLength: 1, opacity: 1 }
                : { pathLength: 0, opacity: 0 }
            }
            transition={{ duration: 0.8, delay: 0.5, ease: 'easeInOut' }}
          />
        </svg>
      </motion.div>

      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-start gap-1.5" style={{ height: 80 }}>
        {drops.map((drop, i) => (
          <div
            key={i}
            className="absolute bottom-0"
            style={{ left: `${drop.left}%` }}
          >
            <motion.div
              custom={i}
              variants={dropVariants}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              className="rounded-full"
              style={{
                width: drop.width,
                height: 0,
                background: 'linear-gradient(180deg, #C9A96E 0%, rgba(201, 169, 110, 0.2) 100%)',
                borderRadius: `${drop.width / 2}px ${drop.width / 2}px ${drop.width / 2}px ${drop.width / 2}px`,
                transformOrigin: 'top center',
              }}
            />
            <motion.div
              custom={i}
              variants={dropVariants}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-accent/40"
              style={{
                width: drop.width * 0.6,
                height: 0,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default DripSignature;
