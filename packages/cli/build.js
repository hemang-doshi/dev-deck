import { cp, mkdir, rm } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Cleaning dist directory...");
  await rm(path.join(__dirname, "dist"), { recursive: true, force: true });
  await mkdir(path.join(__dirname, "dist"), { recursive: true });

  console.log("Compiling type definitions...");
  try {
    execSync("npx tsc -p tsconfig.json --emitDeclarationOnly --outDir dist", {
      cwd: __dirname,
      stdio: "inherit",
    });
  } catch (error) {
    console.warn("Type definition generation warning (proceeding):", error.message);
  }

  console.log("Bundling CLI with esbuild...");
  await build({
    bundle: true,
    entryPoints: [path.join(__dirname, "src", "index.ts")],
    external: ["ws", "yaml", "fsevents"],
    format: "esm",
    minify: true,
    outfile: path.join(__dirname, "dist", "index.js"),
    platform: "node",
    target: "node20",
  });

  console.log("Copying dashboard assets...");
  const srcDashboard = path.resolve(__dirname, "../../apps/dashboard/out");
  const destDashboard = path.join(__dirname, "dist/dashboard");

  try {
    await cp(srcDashboard, destDashboard, { recursive: true });
    console.log("Dashboard assets copied successfully.");
  } catch (error) {
    console.warn("Warning: Could not copy dashboard assets (make sure apps/dashboard is built first):", error.message);
  }

  console.log("CLI build complete!");
}

main().catch((err) => {
  console.error("Build script failed:", err);
  process.exit(1);
});
