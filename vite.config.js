import { defineConfig } from 'vite'

export default defineConfig({
  root: 'SL8-AI (MVP)',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'SL8-AI (MVP)/index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 4173,
    open: true
  }
})
