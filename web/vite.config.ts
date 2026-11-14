import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Zapisuje `dist/version.json` z identyfikatorem buildu (VITE_APP_VERSION,
 * w produkcji hash commita). Pozwala sprawdzić z zewnątrz, która wersja
 * frontendu jest aktualnie opublikowana.
 */
function versionFile(version: string): Plugin {
  let outDir = "dist";
  return {
    name: "version-file",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      await mkdir(outDir, { recursive: true });
      await writeFile(
        join(outDir, "version.json"),
        `${JSON.stringify({ version, builtAt: new Date().toISOString() })}
`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const appVersion = env.VITE_APP_VERSION || "dev";
  const proxy = {
    "/api": {
      target: env.API_PROXY_TARGET || "http://127.0.0.1:8000",
      changeOrigin: true,
    },
  };
  return {
    plugins: [
      react(),
      versionFile(appVersion),
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
          // version.json ma zawsze odzwierciedlać wdrożoną wersję, nie cache.
          globIgnores: ["**/version.json"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [
            /^\/api(?:\/|$)/,
            /^\/(?:health|docs|openapi\.json|version\.json)$/,
          ],
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
