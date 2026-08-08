import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
import { readFileSync } from "fs";
import "dotenv/config";

// https://vite.dev/config/
export default defineConfig({
  build: {
    assetsInlineLimit: 0
  },
  plugins: [vue(), nodePolyfills()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_SERVER_HOSTNAME,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/socket.io": {
        target: process.env.VITE_SERVER_HOSTNAME,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
    https: {
      pfx: readFileSync(
        path.resolve(__dirname, process.env.PfxPath?.toString()!),
      ),
      passphrase: process.env.PfxSecret,
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
});
