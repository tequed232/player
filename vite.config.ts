import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web application lives in ./web (Vite root) so the repository root keeps
// hosting the legacy single-file page and the Android project untouched.
// The production build is emitted to ./dist at the repository root.
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    cssTarget: 'chrome100',
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
