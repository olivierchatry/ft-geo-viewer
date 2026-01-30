import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  // Set base path for GitHub Pages deployment
  // This uses the repository name as the base path
  base: '/ft-geo-viewer/',
  build: {
    // Three.js is ~580KB minified, raise limit to avoid warning
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Three.js into its own chunk for better caching
          three: ['three'],
        },
      },
    },
  },
})
