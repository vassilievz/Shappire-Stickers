import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.js'],
    restoreMocks: true,
  },
});
