import { defineConfig } from 'vitest/config';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is required to run the PostgreSQL integration suite.');
}

export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    passWithNoTests: false,
    testTimeout: 20_000,
    hookTimeout: 20_000
  }
});
