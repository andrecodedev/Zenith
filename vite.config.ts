import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@imgly/background-removal', 'onnxruntime-web'],
  },
  server: {
    watch: {
      // .venv + modelos TTS têm dezenas de milhares de arquivos;
      // o Linux estoura inotify (ENOSPC) se o Vite tentar observar isso.
      ignored: [
        '**/api-tts/**',
        '**/api/node_modules/**',
        '**/api/uploads/**',
        '**/api-video/**',
      ],
    },
  },
})
