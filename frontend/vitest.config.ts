import { defineConfig } from 'vitest/config';

// Fuso esplicito del runner per i test estate/inverno; nessun effetto sul fuso dell'app.
process.env.TZ = 'Europe/Rome';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
});
