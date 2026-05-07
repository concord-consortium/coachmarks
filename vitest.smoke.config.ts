import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Mirrors vite.config.ts's test settings except the include/exclude pair —
// duplication is intentional here so the parent config's exclusion of
// `tests/smoke.test.ts` doesn't bleed in via mergeConfig's array-append.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/smoke.test.ts"],
  },
});
