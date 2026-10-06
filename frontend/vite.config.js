import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The dev server proxies /api to the Express backend.
 *
 * This keeps the auth cookie first-party during development (same-origin), so
 * the HttpOnly session behaves exactly as it will in production and no CORS
 * preflight is involved in the cookie path.
 */
const backendEnvDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'backend');
const frontendEnvDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, backendEnvDir, 'PORT');
  const frontendEnv = loadEnv(mode, frontendEnvDir, 'VITE_');
  const backendPort = process.env.PORT || backendEnv.PORT || '5000';
  const proxyTarget = process.env.VITE_PROXY_TARGET
    || frontendEnv.VITE_PROXY_TARGET
    || `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
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
  };
});
