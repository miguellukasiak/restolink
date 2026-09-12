import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss()],
  // Relative asset paths. The build has to survive being dropped into an
  // arbitrary directory on cheap shared hosting (`/`, `/landing/`, a user dir
  // like `~/public_html/restolink/`), and the default absolute `/assets/...`
  // would 404 anywhere but the domain root.
  base: './',
  build: {
    target: 'es2022',
    // One page, a handful of kilobytes — inlining beats extra round trips,
    // which matters more than caching granularity on shared hosting.
    assetsInlineLimit: 4096,
  },
});
