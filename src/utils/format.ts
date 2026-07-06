export function formatINR(amount: number | null | undefined): string {
  if (!amount && amount !== 0) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export function discountPercent(original: number, current: number): number | null {
  if (!original || original <= current) return null;
  return Math.round(((original - current) / original) * 100);
}
