import { defineConfig } from 'vite'
import { resolve } from 'path'

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
    rollupOptions: {
      // Include all HTML entry points so Vite compiles sub-windows into dist/
      input: {
        main: resolve(__dirname, 'index.html'),
        splash: resolve(__dirname, 'src/splash.html'),
        timer: resolve(__dirname, 'src/timer-window.html'),
        memo: resolve(__dirname, 'src/memo-window.html'),
        kanban: resolve(__dirname, 'src/kanban-window.html'),
        weather: resolve(__dirname, 'src/weather-details.html'),
        settings: resolve(__dirname, 'src/settings.html'),
      }
    }
  },
})
