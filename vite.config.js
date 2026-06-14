import { defineConfig } from 'vite';
// Force config reload to pick up plugin changes
import aiContextWatcher from './vite-plugin-ai-context.js';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
    cloudflare(),
    aiContextWatcher(),
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: [
      '@huggingface/transformers',
      'onnxruntime-web',
      'onnxruntime-web/webgpu',
      'browser-image-compression'
    ],
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
      '@': '/src/client',
    },
  },
});
