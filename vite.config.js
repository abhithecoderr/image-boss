import { defineConfig } from 'vite';
// Force config reload to pick up plugin changes
import aiContextWatcher from './vite-plugin-ai-context.js';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { readdir, unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Strips the bundled ONNX Runtime .wasm binaries from the build output.
 *
 * Every worker sets `wasmPaths` to the jsDelivr CDN at runtime, so the local
 * copies Vite emits (~50MB across two files) are never fetched — they only
 * inflate deploy artifacts. This plugin deletes them after bundling.
 */
function stripUnusedOrtWasm() {
  return {
    name: 'strip-unused-ort-wasm',
    apply: 'build',
    async closeBundle() {
      const assetsDir = join(process.cwd(), 'dist', 'client', 'assets');
      try {
        const files = await readdir(assetsDir);
        await Promise.all(
          files
            .filter((f) => f.startsWith('ort-wasm-simd-threaded') && f.endsWith('.wasm'))
            .map((f) => unlink(join(assetsDir, f)).catch(() => {}))
        );
      } catch (_) {
        // dist/assets may not exist in server-only builds — ignore.
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
    cloudflare(),
    // aiContextWatcher(),
    stripUnusedOrtWasm(),
  ],
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        // Split stable vendor libs into their own cacheable chunks so app-code
        // changes don't invalidate the browser cache for react/router/zustand.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // React core + router — shared by every route, cache aggressively.
          if (id.includes('node_modules/react-router') ||
              id.includes('node_modules/react-dom') ||
              id.match(/node_modules\/react\//)) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/zustand')) {
            return 'vendor-react';
          }
          // Heavy image-crop lib only used inside the workspace editor.
          if (id.includes('node_modules/react-image-crop')) {
            return 'editor-crop';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      '@huggingface/transformers',
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
