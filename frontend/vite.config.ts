import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
import { readFileSync } from "fs";
import "dotenv/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), nodePolyfills()],
  server: {
    proxy: {
      "/api": {
        target: "https://localhost:8080",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/socket.io": {
        target: "https://localhost:8080",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
    https: {
      pfx: readFileSync(
        path.resolve(__dirname, "../server/security/newkey.pfx"),
      ),
      passphrase: process.env.PfxSecret,
    },
    hmr: {
      clientPort: 443,
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
});
