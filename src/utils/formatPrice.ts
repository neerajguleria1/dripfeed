/**
 * Format a number as Indian Rupees with proper INR grouping.
 * e.g., 100000 → "₹1,00,000"
 *       1499.5 → "₹1,500" (rounds to nearest integer)
 */
export function formatPrice(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '₹0';
  const rounded = Math.round(amount);
  return `₹${rounded.toLocaleString('en-IN')}`;
}

/**
 * Calculate discount percentage between originalPrice and currentPrice.
 * Returns 0 if original is not greater than current.
 */
export function calculateDiscount(originalPrice: number, currentPrice: number): number {
  if (originalPrice <= 0 || currentPrice < 0 || originalPrice <= currentPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

/**
 * Format a price drop as a readable string.
 * e.g., "Save ₹500 (33% off)"
 */
export function formatSavings(originalPrice: number, currentPrice: number): string {
  const savings = originalPrice - currentPrice;
  if (savings <= 0) return '';
  const percent = calculateDiscount(originalPrice, currentPrice);
  return `Save ${formatPrice(savings)} (${percent}% off)`;
}
