import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  test: {
    include: mode === "live"
      ? ["tests/live/**/*.test.ts"]
      : mode === "omr"
      ? ["tests/omr/**/*.test.ts"]
      : ["{api,src,tests}/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "tests/fixtures/**",
      ...(
        mode === "live" || mode === "omr" ? [] : ["tests/live/**", "tests/omr/**"]
      ),
    ],
    server: { deps: { inline: ["@techstark/opencv-js"] } },
    setupFiles: mode === "live" ? [] : ["./tests/block-network.ts"],
    testTimeout: mode === "live" || mode === "omr" ? 120_000 : 15_000,
  },
}));
