/**
 * format.ts
 *
 * Re-exports from the canonical formatPrice.ts utility.
 * This shim preserves all existing import paths throughout the codebase —
 * any file importing `{ formatINR }` or `{ discountPercent }` from
 * './format' or '../utils/format' continues to work without modification.
 *
 * Do not add logic here — put it in formatPrice.ts instead.
 */
export { formatINR, discountPercent } from './formatPrice';
