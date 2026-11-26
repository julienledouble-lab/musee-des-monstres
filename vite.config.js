import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5180 }, // 5173 is used by another project on this machine
  // Phaser alone is ~1.2 MB (350 kB gzipped). Never inline images as data: URLs,
  // so every sprite and tile is loaded by Phaser the same way.
  build: { chunkSizeWarningLimit: 1600, assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.js'] },
});
