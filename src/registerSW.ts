/**
 * Register service worker with MIME-type pre-check.
 * If Vercel deployment protection intercepts /sw.js and returns HTML,
 * we skip registration silently instead of throwing a MIME type error.
 */
export function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      // Pre-check: fetch sw.js and verify it's actually JavaScript
      const res = await fetch('/sw.js', { method: 'HEAD' });
      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('javascript')) {
        console.warn(
          `[SW] Skipping registration — /sw.js returned "${contentType}" instead of JavaScript. ` +
          'This usually means Vercel Deployment Protection is active.'
        );
        return;
      }

      await navigator.serviceWorker.register('/sw.js');
    } catch {
      // Silently fail — SW is progressive enhancement, not critical
      console.warn('[SW] Service worker registration failed');
    }
  });
}
