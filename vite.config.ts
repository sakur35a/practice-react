import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const backendUrl = loadEnv(mode, process.cwd(), '').VITE_API_BASE_URL

  return {
    plugins: [react(), tailwindcss()],
    server: backendUrl
      ? {
          proxy: {
            '/api': {
              target: backendUrl,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          },
        }
      : undefined,
  }
})
