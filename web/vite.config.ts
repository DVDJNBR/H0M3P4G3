import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Dev-only: the Vite dev server forwards API calls to the local Hono
      // server so the browser talks to a single origin (AD-1 at runtime).
      // Honours the same PORT env var (and default) as the server.
      '/api': `http://localhost:${process.env.PORT ?? 3000}`,
    },
  },
});
