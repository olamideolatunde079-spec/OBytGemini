import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      // Proxy all /api requests to the backend Express server
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        cookieDomainRewrite: "localhost",
      },
    },
  },
});
