import type { Variants, Transition } from 'framer-motion';

// ─── Timing Tokens ──────────────────────────────────
export const DURATION = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
} as const;

export const EASE = {
  default: [0.4, 0, 0.2, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
  out: [0, 0, 0.2, 1] as const,
};

// ─── Reusable Transitions ───────────────────────────
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 24,
};

export const smoothTransition: Transition = {
  duration: DURATION.normal,
  ease: EASE.default,
};

// ─── Framer Motion Variants ─────────────────────────

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.normal } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: springTransition },
  exit: { opacity: 0, y: 20, transition: { duration: DURATION.fast } },
};

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: springTransition },
  exit: { opacity: 0, y: -20, transition: { duration: DURATION.fast } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: springTransition },
  exit: { opacity: 0, scale: 0.9, transition: { duration: DURATION.fast } },
};

export const staggerChildren: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: smoothTransition },
};

// ─── Card Hover Effect ──────────────────────────────
export const cardHover: Variants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -4,
    transition: { duration: DURATION.normal, ease: EASE.default },
  },
};

// ─── Toast Animation ────────────────────────────────
export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springTransition },
  exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: DURATION.fast } },
};

// ─── Modal Animation ────────────────────────────────
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springTransition },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: DURATION.fast } },
};

// ─── Heart/Save Animation ───────────────────────────
export const heartPulse: Variants = {
  rest: { scale: 1 },
  active: {
    scale: [1, 1.3, 0.9, 1.1, 1],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
};

// ─── Skeleton Shimmer (CSS-based — see index.css) ───
// Uses @keyframes shimmer in CSS for performance

// ─── Page Transition ────────────────────────────────
export const pageTransition: Variants = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0, transition: { duration: DURATION.normal, ease: EASE.out } },
  exit: { opacity: 0, x: -10, transition: { duration: DURATION.fast } },
};

// ─── Deck-Dealt Card Stagger ──────────────────────────────────
export const deckContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

export const dealtCard = {
  hidden: (i: number) => ({
    opacity: 0,
    x: i % 2 === 0 ? -60 : 60,
    y: -30,
    rotate: i % 2 === 0 ? -12 : 12,
    scale: 0.85,
  }),
  visible: {
    opacity: 1, x: 0, y: 0, rotate: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 260, damping: 20, mass: 0.9 },
  },
};
