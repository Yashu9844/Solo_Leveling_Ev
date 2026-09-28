import { defineConfig } from 'vite';
import pkg from './package.json';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // The About screen prints a real version rather than a hardcoded
  // string that would drift the first time package.json moved.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // woff2 is not optional here: the three self-hosted families are
        // the type system (design/00-DESIGN-SYSTEM.md §4), and this app is
        // offline-first by design. Without them precached, an offline
        // launch silently falls back to system fonts.
        // Deliberately no `webp`: that extension is the art (2.2 MB across
        // 16 slots), and precaching it would make a first install pay for
        // decoration on every screen the user may never open. Every art
        // slot has a procedural gradient fallback and an inline LQIP, so
        // a screen is complete before its plate arrives. Art is picked up
        // by the CacheFirst rule below on first view instead.
        // See design/00-DESIGN-SYSTEM.md §2.6.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // The System's rendered voice, cached the same way and for the
            // same reason as the art above: the pack is 4.8 MB across 166
            // clips, and a Player hears one or two lines a day. Precaching
            // all of it would make every install pay for 164 sentences it
            // will not hear that week. Each clip is permanent once heard,
            // so the lines that matter — the ones this Player's actual
            // states produce — accumulate offline within days, and a
            // missing clip falls back to the device's own speech engine
            // rather than to silence. See design/04 §16.1.
            urlPattern: /\/voice\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'system-voice-v1',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // The app still makes no *data* requests — this is same-origin
            // art only, and it is immutable: Vite content-hashes every
            // filename, so a changed plate is a new URL and CacheFirst can
            // never serve a stale one.
            urlPattern: /\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'system-art-v1',
              // 16 slots x 2 widths = 32, plus headroom for new plates.
              expiration: { maxEntries: 48, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // On in dev so the manifest actually exists there. With it off
        // the plugin emitted nothing, the injected <link rel="manifest">
        // resolved through navigateFallback to index.html, and every dev
        // page load logged "Manifest: Line: 1, column: 1, Syntax error."
        // — the browser parsing HTML as JSON.
        enabled: true,
        type: 'module',
      },
      manifest: {
        id: '/',
        name: 'SYSTEM',
        short_name: 'SYSTEM',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A0B0D',
        theme_color: '#0A0B0D',
        // The sigil set in public/. No `maskable` entry: a maskable icon
        // has to be drawn with a safe zone, because Android crops it to
        // whatever shape the launcher uses, and declaring an ordinary
        // icon maskable is how logos lose their edges. Without one the
        // launcher letterboxes the icon instead, which is the safe
        // failure. Add a purpose-built maskable render to restore it.
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
        shortcuts: [
          { name: 'Log problem', url: '/log/problem' },
          { name: 'Log application', url: '/log/application' },
          { name: 'Evening review', url: '/review' },
        ],
      },
    }),
  ],
});
