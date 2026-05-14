import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: false,
    open: true,
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'ws'
    }
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    sourcemap: false
  },
  preview: {
    port: 4173,
    strictPort: false
  }
})
