import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  // The contact form posts to `VITE_API_URL`. A build without it would ship a
  // page whose form quietly targets localhost — every lead lost, and nothing
  // on the page itself to say so. Refuse the build instead. `loadEnv` also
  // reads the shell environment, so `VITE_API_URL=… npm run build` works.
  if (command === 'build' && !loadEnv(mode, '.', 'VITE_')['VITE_API_URL']) {
    throw new Error(
      'VITE_API_URL is not set. The contact form needs the API origin, e.g. ' +
        'VITE_API_URL=https://your-api.onrender.com npm run build ' +
        '(see landing-page/.env.example).',
    );
  }

  return {
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
  };
});
