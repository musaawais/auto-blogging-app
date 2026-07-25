import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "dist/index.cjs",
  format: "cjs",
  external: [
    "better-sqlite3",
    "sharp",
  ],
  sourcemap: false,
  minify: false,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

console.log("Server build complete → dist/index.cjs");
