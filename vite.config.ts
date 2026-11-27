import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

// Production-only Content Security Policy (security-v0.2 4.1). The dev server
// injects inline scripts for hot reload, so it isn't applied there. Hosting
// must still send this as a header, plus frame-ancestors (security-v0.2 5.1).
const CSP = [
  "default-src 'self'",
  // Google sign-in and the Picker for sync: exact hosts only, no wildcards (0015 §7.1).
  "script-src 'self' https://accounts.google.com/gsi/client https://apis.google.com",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://sheets.googleapis.com https://www.googleapis.com",
  "frame-src https://accounts.google.com https://docs.google.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const cspMeta = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
})
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app under /Simple_Budget/; the deploy workflow sets BASE_PATH.
const BASE_PATH = process.env.BASE_PATH ?? '/'

// The app shows its version (package.json) at the top of the page.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  base: BASE_PATH,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    cspMeta(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Simple Budget',
        short_name: 'Budget',
        description: 'So simple my partner will use it.',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        icons: [
          { src: `${BASE_PATH}vite.svg`, sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
