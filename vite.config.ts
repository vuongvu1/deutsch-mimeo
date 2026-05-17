import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dropOnnxRuntimeWasm()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
