import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [react(), cloudflare()],
  optimizeDeps: {
    exclude: ['better-auth']
  },
  server: {
    port: 3000,
    historyApiFallback: {
      rewrites: [
        {
          from: /^\/api\/auth\/.*/,
          to: (context) => context.parsedUrl.pathname,
        },
      ],
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
