import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const proxyTarget = env.VITE_API_PROXY_TARGET ||
    (env.API_BACKEND_URL ? (env.API_BACKEND_URL.startsWith('http') ? env.API_BACKEND_URL : `http://${env.API_BACKEND_URL}`) : null) ||
    'http://localhost:4000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './src'),
        '@components': path.resolve(process.cwd(), './src/components'),
        '@pages': path.resolve(process.cwd(), './src/pages'),
        '@hooks': path.resolve(process.cwd(), './src/hooks'),
        '@store': path.resolve(process.cwd(), './src/store'),
        '@api': path.resolve(process.cwd(), './src/api'),
        '@utils': path.resolve(process.cwd(), './src/utils'),
        '@styles': path.resolve(process.cwd(), './src/styles'),
      },
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
  };
});
