import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const proxyTarget =
    env.VITE_API_PROXY_TARGET ||
    env.API_BACKEND_URL ||
    'http://localhost:4000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['framer-motion', 'react-hook-form'],
    },
    server: {
      port: 3001,
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
        '/socket.io': {
          target: proxyTarget,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
            'ui-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
            // Split heavy UI libraries into separate chunks for parallel loading
            'ui-antd': ['antd'],
            'ui-radix': [
              '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover', '@radix-ui/react-select',
              '@radix-ui/react-tabs', '@radix-ui/react-tooltip',
              '@radix-ui/react-accordion', '@radix-ui/react-alert-dialog',
            ],
            // Split chart libraries so pages that don't use charts don't load them
            'charts-recharts': ['recharts'],
            'charts-chartjs': ['chart.js', 'react-chartjs-2'],
            // Other heavy deps
            'rich-text': ['react-markdown', 'remark-gfm'],
            'animation': ['framer-motion'],
          },
        },
      },
    },
  };
});
