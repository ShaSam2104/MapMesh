import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/types.ts',
      ],
      thresholds: {
        'src/lib/**/*.{ts,tsx}': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'src/hooks/**/*.{ts,tsx}': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'src/components/**/*.{ts,tsx}': {
          lines: 75,
          functions: 75,
          branches: 70,
          statements: 75,
        },
      },
    },
  },
});
