import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local dev: proxy /api to the wrangler dev Worker on :8787 so the SPA
// and API share an origin exactly like production (kbrelay.lalalimited.com
// serves the SPA; kbrelay.lalalimited.com/api/* is the Worker route).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // The Scalar docs page (KBR-109) is served by the Worker, mirroring the
      // production `kbrelay.lalalimited.com/docs` route. Prefix match is fine —
      // the app has no client-side `/docs*` routes.
      '/docs': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    // jsdom so component tests can mount + drive the real DOM (the create→adopt
    // attach flow is an effect/timing bug that only reproduces in a live tree).
    environment: 'jsdom',
  },
});
