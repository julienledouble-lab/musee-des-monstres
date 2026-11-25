import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1600 }, // Phaser alone is ~1.2 MB (350 kB gzipped)
  test: { include: ['tests/**/*.test.js'] },
});
