import { defineConfig } from 'vitest/config';

// Without this, Vitest's default glob also picks up compiled *.test.js
// left behind by `npm run build` under */dist -- those run against
// whatever schema was current at build time and produce stale failures
// that have nothing to do with the actual source.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
