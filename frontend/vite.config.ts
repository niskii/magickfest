import vue from "@vitejs/plugin-vue";
import { readFileSync } from "fs";
import path from "path";
import { defineConfig, loadEnv, type UserConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig(async ({mode}) => {
   const env = loadEnv(mode, process.cwd())
  const userConfig: UserConfig = {
    build: {
      assetsInlineLimit: 0
    },
    plugins: [vue(), nodePolyfills()],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_SERVER_HOSTNAME,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        "/socket.io": {
          target: env.VITE_SERVER_HOSTNAME,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      }
    },
    resolve: {
      alias: {
        "@shared": path.resolve(import.meta.dirname, "../shared"),
      },
    },
  }

  if (mode === 'development') {
    
    (await import("dotenv")).config({path: `${import.meta.dirname}/.env.development`})

    userConfig.server!.https = {
      pfx: readFileSync(
          path.resolve(import.meta.dirname, process.env.PfxPath?.toString()!),
        ),
        passphrase: process.env.PfxSecret,
      }
  }

  return userConfig
});
