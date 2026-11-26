import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
   server: {
    proxy: {
      '/api': {
        target:       'http://localhost:4000',
        changeOrigin: true,
        secure:       false,
      },
    },
  },

  // `vite preview` serves the production build but, without this, does not
  // proxy /api — so the preview build could not talk to the backend at all.
  preview: {
    proxy: {
      '/api': {
        target:       'http://localhost:4000',
        changeOrigin: true,
        secure:       false,
      },
    },
  },

})