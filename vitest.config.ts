import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      // Deterministic 32-byte key for encryption round-trip tests.
      MASTER_ENCRYPTION_KEY: 'nMAM3ks3wDRLGtZBnZ1m3ACQ/CptgwpsToaujHNJDkg=',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters-long-xx',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
