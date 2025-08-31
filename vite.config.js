import { defineConfig } from 'vite'

export default defineConfig({
  // Tauri configuration
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Allow external connections
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})