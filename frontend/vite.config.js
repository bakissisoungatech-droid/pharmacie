import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: [
      'bakissi.up.railway.app',          // Autorise spécifiquement ton domaine actuel
      '.up.railway.app'                  // Autorise tous les sous-domaines Railway par sécurité
    ]
  }
})
