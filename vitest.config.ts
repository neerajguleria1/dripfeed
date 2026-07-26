import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/**/*.tsx', 'jsdom'],
      ['tests/integration/**', 'jsdom'],
    ],
    include: ['tests/**/*.{test,spec,prop}.{ts,tsx}'],
  },
});
