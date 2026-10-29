import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/math-walk-demo/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
