import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Raise warning threshold — we're actively splitting, so 500 KB base is expected
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Manual chunk strategy: split vendor libs into stable, cacheable chunks.
        // These change rarely so users' browsers cache them across deploys.
        manualChunks(id: string) {
          // Animation libraries — gsap + framer-motion together ~180 KB gzip
          if (id.includes('gsap') || id.includes('@gsap')) {
            return 'vendor-animation';
          }
          // Framer Motion — separate from GSAP so pages that only need one still get it
          if (id.includes('framer-motion') || id.includes('motion-dom')) {
            return 'vendor-motion';
          }
          // React core — almost never changes
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'vendor-react';
          }
          // React Router
          if (id.includes('react-router')) {
            return 'vendor-router';
          }
          // Lucide icons — large, rarely changes
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          // Heavy chart/analysis libs
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }
        },
      },
    },
  },
})
