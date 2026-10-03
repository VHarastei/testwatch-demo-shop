import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { SESSION_SECRET: 'test-secret', VARIANT: 'normal', REPO_URL: '' } },
    }),
  ],
});
