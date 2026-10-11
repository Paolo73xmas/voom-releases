import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

process.env.TZ = 'Europe/Rome';
Object.assign(process.env, loadEnv('test', process.cwd(), 'EXPO_PUBLIC_SUPABASE_'));

export default defineConfig({
  test: {
    include: ['tests/live/**/*.live.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    maxWorkers: 1,
    fileParallelism: false,
  },
});
