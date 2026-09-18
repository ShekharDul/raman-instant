import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'production-content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Build-only: Vite's development refresh scripts need a different policy.
        const policy = "default-src 'self'; script-src 'self' https://www.googletagmanager.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://www.google-analytics.com; connect-src 'self' blob: https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
        return html.replace(/<meta charset="UTF-8"\s*\/?>/i, match => match + '<meta http-equiv="Content-Security-Policy" content="' + policy + '">');
      }
    }
  }],
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
