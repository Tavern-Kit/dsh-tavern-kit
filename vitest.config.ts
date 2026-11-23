import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: {
    '@tavern-kit/rp-connections/routing': fileURLToPath(new URL('./packages/rp-connections/src/routing.ts', import.meta.url)),
    '@tavern-kit/rp-materials/library': fileURLToPath(new URL('./packages/rp-materials/src/store.ts', import.meta.url)),
  } },
  test: {
    include: ['packages/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    maxWorkers: 4,
    restoreMocks: true,
  },
});
