import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        // Rewrite Set-Cookie domain so the browser keeps the session cookie
        // on localhost:5173 requests that are proxied to :5000
        cookieDomainRewrite: "localhost",
      },
    },
  },
});
