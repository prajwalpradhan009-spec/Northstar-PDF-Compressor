import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The dev server proxies /api to the Express backend.
 *
 * This keeps the auth cookie first-party during development (same-origin), so
 * the HttpOnly session behaves exactly as it will in production and no CORS
 * preflight is involved in the cookie path.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Group all framework code into one vendor chunk so app updates do not
    // invalidate React or the router. Done by path prefix rather than a fixed
    // module list, because the JSX runtime (`react/jsx-runtime`) is what React
    // 19 actually pulls in and a fixed list would emit an empty chunk.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'router';
          if (id.includes('react')) return 'react';
          return undefined;
        },
      },
    },
  },
});
