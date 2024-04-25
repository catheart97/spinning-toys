import { PluginOption, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const FullReloadPlugin: PluginOption = {
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" })
    return []
  },
} as unknown as PluginOption

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    FullReloadPlugin
  ],
  resolve: {
    alias: {
      path: 'path-browserify',
    },
  },
  server: {
    host: "0.0.0.0",
    hmr: true
  },
  assetsInclude: [
    "**/*.glb",
    "**/*.hdr"
  ]
})
