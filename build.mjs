import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const out = join(root, "dist");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const readDir = (dir, ext) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"));

/* The source is formatted for reading (npm run format); what ships is whitespace-minified (comments dropped, nothing
   renamed), so readable source doesn't make the app bigger. */
let esbuild;
try {
  esbuild = await import("esbuild");
} catch (e) {
  throw new Error("esbuild is needed to build (run npm install)");
}
const squeeze = (code, loader) =>
  esbuild.transformSync(code, { loader, minifyWhitespace: true, legalComments: "none" }).code;
const css = squeeze(readDir(join(src, "styles"), ".css").join("\n"), "css");
/* src/js/<feature>/*.js are joined in file-name order, whatever their folder (see scripts/check-js.mjs): a numbered
   file (NN-…) runs at that point of startup; an unnumbered one holds only function declarations, which are hoisted,
   so where it lands doesn't matter. */
const jsFiles = (function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith(".js") ? [join(dir, d.name)] : [],
  );
})(join(src, "js")).sort((a, b) => basename(a).localeCompare(basename(b)));
const js = squeeze("(function(){\n" + jsFiles.map((f) => readFileSync(f, "utf8")).join("\n") + "\n})();", "js");
const ach = readFileSync(join(src, "assets", "achievements.json"), "utf8");

let html = readFileSync(join(src, "index.html"), "utf8");
for (const [key, val] of [
  ["css", css],
  ["ach", ach],
  ["js", js],
]) {
  const tag = `/*@inject:${key}*/`;
  if (!html.includes(tag)) throw new Error(`Missing ${tag} in src/index.html`);
  html = html.split(tag).join(val);
}

if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "public"), out, { recursive: true });
rmSync(join(out, "sw.template.js"));
writeFileSync(join(out, "index.html"), html);

/* Firebase SDK facade → dist/vendor/firebase.js (loaded on demand by the app; see src/firebase/fb.js). */
try {
  const { buildSync } = esbuild;
  buildSync({
    entryPoints: [join(src, "firebase", "fb.js")],
    bundle: true,
    format: "esm",
    minify: true,
    target: ["es2020"],
    outfile: join(out, "vendor", "firebase.js"),
    logLevel: "silent",
  });
} catch (e) {
  throw new Error(
    "vendor/firebase.js could not be built (run npm install; esbuild and firebase are needed): " +
      String(e.message || e).split("\n")[0],
  );
}

/* The cache version covers the lazily loaded SDK too, so a change to fb.js alone still reaches installed apps. */
const hash = createHash("sha256")
  .update(html)
  .update(readFileSync(join(out, "vendor", "firebase.js")))
  .digest("hex")
  .slice(0, 8);
const version = `${pkg.version}-${hash}`;
const sw = readFileSync(join(root, "public", "sw.template.js"), "utf8").replace("__VERSION__", version);
writeFileSync(join(out, "sw.js"), sw);

console.log(`Built dist/ (cache ${version}, ${(html.length / 1024).toFixed(0)} KB)`);
