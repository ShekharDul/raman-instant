import { defineConfig } from 'vite';

export default defineConfig({
  base: '/raman-instant/',
  root: './',
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
});
