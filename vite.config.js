import { defineConfig } from 'vite';
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
    cloudflare({
      // The Workers AI binding only runs on Cloudflare's GPU network, so in local
      // dev we proxy bindings to the remote account instead of the local workerd
      // shim (which returns "2021: Invalid User Credentials" for AI calls).
      remoteBindings: true,
    }),
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
        // vendor-react: react core + router | vendor-state: zustand | editor-crop: react-image-crop
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // React core + router — shared by every route, cache aggressively.
          if (id.includes('node_modules/react-router') ||
              id.includes('node_modules/react-dom') ||
              id.match(/node_modules\/react\//)) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
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
    include: [],
    exclude: [
      'better-auth',
      '@huggingface/transformers',
      'onnxruntime-web',
      'browser-image-compression'
    ]
  },
  server: {
    port: 3000,
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
