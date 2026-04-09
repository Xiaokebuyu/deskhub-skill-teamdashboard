import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/mcp': 'http://localhost:3001',
      '/authorize': 'http://localhost:3001',
      '/token': 'http://localhost:3001',
      '/register': 'http://localhost:3001',
      '/oauth': 'http://localhost:3001',
      '/.well-known': 'http://localhost:3001',
    },
  },
});
