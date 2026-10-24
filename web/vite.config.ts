import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const proxy = {
    "/api": {
      target: env.API_PROXY_TARGET || "http://127.0.0.1:8000",
      changeOrigin: true,
    },
  };
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "favicon.svg",
          "manifest.json",
          "icon-192.png",
          "icon-512.png",
          "maskable-512.png",
          "apple-touch-icon.png",
        ],
        manifest: false,
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,json}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          runtimeCaching: [
            {
              urlPattern: ({ request, url, sameOrigin }) =>
                sameOrigin &&
                request.method === "GET" &&
                !request.headers.has("Authorization") &&
                url.pathname === "/api/v1/products" &&
                !url.searchParams.has("include_inactive"),
              handler: "NetworkFirst",
              options: {
                cacheName: "catalog-products-v1",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ request, url, sameOrigin }) =>
                sameOrigin &&
                request.method === "GET" &&
                !request.headers.has("Authorization") &&
                /^\/api\/v1\/products\/\d+$/.test(url.pathname),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "catalog-details-v1",
                expiration: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ request, url, sameOrigin }) =>
                sameOrigin &&
                request.method === "GET" &&
                !request.headers.has("Authorization") &&
                url.pathname === "/api/v1/categories",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "catalog-categories-v1",
                expiration: { maxEntries: 5, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
    ],
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
  };
});
