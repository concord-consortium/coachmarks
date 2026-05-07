import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: { tsconfig: "tsconfig.build.json" },
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@floating-ui/react",
    /\.css$/,
  ],
  outDir: "dist",
  clean: true,
});
