import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "/kvu-offline/",
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "masked-icon.svg",
        "offline.html",
      ],
      manifest: {
        name: "KVU Offline",
        short_name: "KVU Offline",
        description: "Offline audiobook player for knigavuhe.org",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/kvu-offline/",
        start_url: "/kvu-offline/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        navigateFallback: "/kvu-offline/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/s2\.knigavuhe\.org\/.*\.mp3$/,
            handler: "CacheFirst",
            options: {
              cacheName: "audio-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      strategies: "injectManifest",
      srcDir: "src/service-worker",
      filename: "sw.ts",
    }),
  ],
  server: {
    proxy: {
      "/api/proxy": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
});
