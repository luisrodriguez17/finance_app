import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Test-only config: the PWA plugin from vite.config.ts is deliberately left out —
// it has nothing to exercise under jsdom and slows the run down.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
