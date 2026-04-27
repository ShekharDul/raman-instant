import { defineConfig } from 'vite';

export default defineConfig({
  base: '/raman-instant/',
  root: './',
  optimizeDeps: {
    exclude: ['xlsx']
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
        docs: './docs.html'
      }
    }
  }
});
