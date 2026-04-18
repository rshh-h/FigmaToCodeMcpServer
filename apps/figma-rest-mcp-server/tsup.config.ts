import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/http.ts", "src/stdio.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  noExternal: ["codegen-kernel", "codegen-types"],
});
