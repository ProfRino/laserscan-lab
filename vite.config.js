import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    // The offline deliverable deliberately embeds the complete rendering engine.
    chunkSizeWarningLimit: 650,
    rollupOptions: { output: { inlineDynamicImports: true, format: 'iife' } }
  }
});
