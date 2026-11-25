import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> web/dist/ for uploading to a website.
// `npm run build:single` -> ../play/juraea-frontiers.html, one file with
//                           everything inlined; opens by double-click, no server.
export default defineConfig(({ mode }) =>
  mode === 'single'
    ? {
        base: './',
        plugins: [viteSingleFile()],
        build: { target: 'es2020', outDir: '../play', emptyOutDir: false, assetsInlineLimit: 100_000_000 },
      }
    : {
        // base: './' lets the built folder live in any sub-path of your website.
        base: './',
        build: { target: 'es2020', cssCodeSplit: false, assetsInlineLimit: 0 },
      },
);
