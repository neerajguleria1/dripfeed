import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const letterVariants = {
  hidden: { y: 20, opacity: 0, rotateX: -40 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    rotateX: 0,
    transition: {
      duration: 0.4,
      delay: i * 0.04,
      ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
    },
  }),
};

const lineVariants = {
  hidden: { width: 0 },
  visible: {
    width: '100%',
    transition: { duration: 0.6, delay: 0.8, ease: 'easeInOut' as const },
  },
};

export interface FontPairingProps {
  className?: string;
}

export function FontPairing({ className = '' }: FontPairingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  const displayText = 'DripFeed';
  const bodySnippet = 'Compare prices across 7+ platforms.';

  return (
    <div ref={ref} className={`space-y-8 ${className}`}>
      {/* Display Font */}
      <div>
        <motion.p
          initial={{ opacity: 0, x: -8 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.3 }}
          className="text-xs font-medium tracking-widest uppercase mb-3"
          style={{ color: '#C9A96E' }}
        >
          Display — Lobster Two
        </motion.p>

        <div className="flex flex-wrap">
          {displayText.split('').map((char, i) => (
            <motion.span
              key={`${char}-${i}`}
              custom={i}
              variants={letterVariants}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              className="text-5xl sm:text-6xl font-bold leading-tight"
              style={{
                fontFamily: "'Lobster Two', cursive",
                color: '#1A1A2E',
                textShadow: '0 2px 8px rgba(26, 26, 46, 0.08)',
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </div>

        <motion.div
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={lineVariants}
          className="h-px mt-2"
          style={{ background: 'linear-gradient(90deg, #C9A96E 0%, rgba(201, 169, 110, 0.1) 100%)' }}
        />
      </div>

      {/* Body Font */}
      <div>
        <motion.p
          initial={{ opacity: 0, x: -8 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="text-xs font-medium tracking-widest uppercase mb-3"
          style={{ color: '#C9A96E' }}
        >
          Body — Inter
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
          className="text-lg sm:text-xl leading-relaxed max-w-md"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            color: '#4B5563',
            fontWeight: 400,
          }}
        >
          {bodySnippet}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.65, ease: 'easeOut' }}
          className="text-sm leading-relaxed max-w-md mt-2"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            color: '#9CA3AF',
            fontWeight: 400,
          }}
        >
          Get AI recommendations on whether to buy now or wait and save.
        </motion.p>
      </div>

      {/* Font Weights Showcase */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="flex flex-wrap items-center gap-4 pt-2"
      >
        {[
          { weight: 'Light', className: 'font-light' },
          { weight: 'Regular', className: 'font-normal' },
          { weight: 'Medium', className: 'font-medium' },
          { weight: 'Semi Bold', className: 'font-semibold' },
          { weight: 'Bold', className: 'font-bold' },
        ].map((w) => (
          <span
            key={w.weight}
            className={`text-sm ${w.className}`}
            style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#6B7280' }}
          >
            {w.weight}
          </span>
        ))}
        <ArrowRight className="w-4 h-4" style={{ color: '#C9A96E' }} />
      </motion.div>
    </div>
  );
}

export default FontPairing;
