import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api/* is proxied to Express, so the frontend always calls relative URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
  },
});
