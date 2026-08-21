import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

let commitHash = "dev";
try {
  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "--short", "HEAD"],
  });
  const output = cmd.outputSync();
  commitHash = new TextDecoder().decode(output.stdout).trim() || "dev";
} catch {
  // fallback in non-git environments
}

export default defineConfig({
  base: "./",
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Accordion Lead Sheet Companion",
        short_name: "AccordionTab",
        description: "Mobile-first accordion lead sheet converter and practice companion",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "portrait-primary",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  build: {
    outDir: "dist",
    target: "esnext",
    sourcemap: false,
  },
});
