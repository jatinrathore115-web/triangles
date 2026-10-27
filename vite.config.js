import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5199, strictPort: true },
  build: {
    chunkSizeWarningLimit: 2000,
    // Single classic (non-module) bundle with fonts inlined, so the standalone build
    // also runs when opened straight from disk (file://), see scripts/make-standalone.mjs.
    modulePreload: false,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
});
