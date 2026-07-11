import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vanguard/domain': path.resolve(__dirname, './packages/domain/src/index.ts')
    }
  },
  test: {
    // happy-dom provides full DOM support needed by @testing-library/react
    environment: 'happy-dom',
    globals: true,
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      // supabase/functions/ tests use Deno https: imports — run via `npm run test:edge` instead
    ],
    setupFiles: ['./src/test/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/lib/database.types.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/sw.ts',
      ],
      thresholds: {
        // Baseline 30% — raise by ~5% each sprint
        branches: 30,
        functions: 30,
        lines: 30,
      },
    },
  },
});


