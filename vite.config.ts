import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: './frontend',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow external connections
    allowedHosts: [
      'localhost',
      '.trycloudflare.com', // Allow all Cloudflare tunnel subdomains
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'frontend/dist'),
    emptyOutDir: true,
  },
});

