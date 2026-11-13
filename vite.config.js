// Vite is the build tool: it serves the app while you develop and bundles it
// into plain static files (the `dist/` folder) for deployment.
//
// `defineConfig` comes from "vitest/config" (instead of "vite") only so the
// `test` section below is recognised. Everything else is standard Vite.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    // vite-plugin-pwa generates two things at build time:
    //   1. manifest.webmanifest – tells the phone the app's name, icon, colors.
    //   2. sw.js – a service worker that caches the app's files so it opens
    //      without a network connection.
    VitePWA({
      // "prompt" = when a new version is deployed we show a small
      // "Update available" banner instead of reloading the page on our own.
      // An automatic reload could wipe a half-written log entry.
      registerType: "prompt",

      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],

      manifest: {
        id: "/",
        name: "Emotional Trigger Tracker",
        short_name: "Triggers",
        description:
          "A private, offline tool for noticing which emotions come before an urge.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f6f5f1",
        theme_color: "#f6f5f1",
        categories: ["health", "lifestyle"],
        icons: [
          { src: "icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Log an urge",
            short_name: "Log",
            url: "/log",
            icons: [{ src: "icons/pwa-192.png", sizes: "192x192" }],
          },
        ],
      },

      workbox: {
        // Precache only the app's own static files (the "application shell").
        // Your logs live in IndexedDB, which the service worker never touches,
        // so no personal data ends up in a network cache.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Any in-app URL (e.g. /history) falls back to index.html offline,
        // and React Router then shows the right page.
        navigateFallback: "/index.html",
        // Remove caches left behind by older versions of the app.
        cleanupOutdatedCaches: true,
      },
    }),
  ],

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },

  // Vitest (the test runner) settings.
  test: {
    // jsdom is a simulated browser so components can render inside Node.
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
    include: ["src/**/*.test.{js,jsx}"],
  },
});
