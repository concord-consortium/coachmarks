import { cpSync, existsSync } from "node:fs";

if (!existsSync("src/styles")) {
  console.error("Error: src/styles/ not found");
  process.exit(1);
}
cpSync("src/styles", "dist/styles", { recursive: true });
