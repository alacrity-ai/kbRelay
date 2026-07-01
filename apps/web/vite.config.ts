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
    },
  },
});
