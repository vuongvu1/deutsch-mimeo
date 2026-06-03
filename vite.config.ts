import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const dropOnnxRuntimeWasm = (): Plugin => ({
  name: 'drop-onnxruntime-wasm',
  generateBundle(_options, bundle) {
    for (const fileName of Object.keys(bundle)) {
      if (/ort-wasm.*\.wasm$/.test(fileName)) {
        delete bundle[fileName]
      }
    }
  },
})

// Serve the project-root /voices/ directory at /voices/* during dev so the
// Piper TTS web fetch (rewritten to /voices/... when import.meta.env.DEV) hits
// local files instead of raw.githubusercontent.com. In prod those files are
// fetched from GitHub since they're too large (~60 MiB each) for CF Assets.
//
// enforce: 'pre' + middleware registered via the early hook ensures we run
// ahead of @cloudflare/vite-plugin's worker handler, which would otherwise
// route /voices/* through the Worker and 404 (Worker's ASSETS binding doesn't
// know about /voices/).
const serveVoices = (): Plugin => ({
  name: 'serve-voices',
  enforce: 'pre',
  configureServer(server) {
    const voicesDir = path.resolve(server.config.root, 'voices')
    server.middlewares.use('/voices', (req, res, next) => {
      const url = req.url ?? ''
      const filename = url.replace(/^\//, '').split('?')[0]
      if (!filename) return next()
      const filepath = path.join(voicesDir, filename)
      // Block path traversal.
      if (!filepath.startsWith(voicesDir + path.sep)) return next()
      if (!fs.existsSync(filepath)) return next()
      res.setHeader(
        'Content-Type',
        filename.endsWith('.json') ? 'application/json' : 'application/octet-stream',
      )
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      fs.createReadStream(filepath).pipe(res)
    })
  },
})

export default defineConfig({
  plugins: [
    serveVoices(),
    react(),
    cloudflare(),
    dropOnnxRuntimeWasm(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false },
      manifest: {
        name: 'Deutsch MiMeo',
        short_name: 'MiMeo',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0d0f14',
        background_color: '#0d0f14',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-wasm',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})