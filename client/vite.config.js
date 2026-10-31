import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api calls go to the Express server so cookies stay same-site.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
});
