import { defineConfig } from 'vite';

// base: './' lets the built folder live in any sub-path of your website.
export default defineConfig({
  base: './',
  build: { target: 'es2020', cssCodeSplit: false, assetsInlineLimit: 0 },
});
