import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, '../../'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@online-chess/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('/node_modules/')) return;

          if (normalized.includes('/node_modules/chess.js/')) {
            return 'vendor-chess-engine';
          }
          if (
            normalized.includes('/node_modules/react-chessboard/') ||
            normalized.includes('/node_modules/react-dnd/') ||
            normalized.includes('/node_modules/react-dnd-html5-backend/') ||
            normalized.includes('/node_modules/react-dnd-touch-backend/') ||
            normalized.includes('/node_modules/dnd-core/') ||
            normalized.includes('/node_modules/@react-dnd/')
          ) {
            return 'vendor-chessboard';
          }
          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/') ||
            normalized.includes('/node_modules/scheduler/') ||
            normalized.includes('/node_modules/react-router/') ||
            normalized.includes('/node_modules/react-router-dom/') ||
            normalized.includes('/node_modules/@remix-run/router/') ||
            normalized.includes('/node_modules/@tanstack/') ||
            normalized.includes('/node_modules/zustand/')
          ) {
            return 'vendor-react';
          }
          if (
            normalized.includes('/node_modules/react-hook-form/') ||
            normalized.includes('/node_modules/@hookform/') ||
            normalized.includes('/node_modules/zod/')
          ) {
            return 'vendor-forms';
          }
          if (
            normalized.includes('/node_modules/socket.io-client/') ||
            normalized.includes('/node_modules/engine.io-client/') ||
            normalized.includes('/node_modules/socket.io-parser/') ||
            normalized.includes('/node_modules/engine.io-parser/')
          ) {
            return 'vendor-socket';
          }
          if (normalized.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (normalized.includes('/node_modules/axios/')) {
            return 'vendor-http';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
