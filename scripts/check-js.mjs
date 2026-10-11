/* Checks the src/js module rules (run by npm test and npm run check:js):
   - every file is an ES module whose top level holds only imports and exports: exported functions, and exported
     `var` declarations without a value (values are assigned in init());
   - startup code lives only in a numbered file's (NN-… / NNb-…) `export function init()`, and main.js calls every
     init in file-number order: that is the app's startup order;
   - unnumbered files hold functions only; file names and top-level names are unique across src/js. */
import { readFileSync, readdirSync } from "node:fs";
import { join, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "prettier/plugins/babel";

const root = join(fileURLToPath(import.meta.url), "..", "..", "src", "js");
const files = (function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith(".js") ? [join(dir, d.name)] : [],
  );
})(root);
const parse = (f) => babel.parsers.babel.parse(readFileSync(f, "utf8"), {}).program.body;
const errors = [],
  names = {},
  tops = {},
  inits = [];
for (const f of files) {
  const b = basename(f),
    rel = relative(root, f);
  if (rel === "main.js") continue;
  if (names[b]) errors.push(`${rel}: same file name as ${names[b]}`);
  names[b] = rel;
  const numbered = /^\d\d[a-z]?-/.test(b);
  let hasInit = false;
  for (const n of parse(f)) {
    if (n.type === "ImportDeclaration") continue;
    const d = n.type === "ExportNamedDeclaration" && n.declaration;
    if (d && d.type === "FunctionDeclaration") {
      if (d.id.name === "init") {
        if (!numbered) errors.push(`${rel}: only numbered files have init()`);
        hasInit = true;
        continue;
      }
      if (tops[d.id.name]) errors.push(`${rel}: ${d.id.name} is also declared in ${tops[d.id.name]}`);
      tops[d.id.name] = rel;
      continue;
    }
    if (d && d.type === "VariableDeclaration" && d.declarations.every((x) => !x.init)) {
      if (!numbered) errors.push(`${rel}: unnumbered files hold functions only (line ${n.loc.start.line})`);
      for (const x of d.declarations) {
        if (tops[x.id.name]) errors.push(`${rel}: ${x.id.name} is also declared in ${tops[x.id.name]}`);
        tops[x.id.name] = rel;
      }
      continue;
    }
    if (rel === "core/g.js" && d && d.type === "VariableDeclaration") continue;
    errors.push(
      `${rel}: line ${n.loc.start.line}: top level may only hold imports, exported functions and exported vars without a value; startup code goes in a numbered file's init()`,
    );
  }
  if (numbered && !hasInit) errors.push(`${rel}: numbered files export init() (or drop the number)`);
  if (hasInit) inits.push(rel);
}
inits.sort((a, b) => basename(a).localeCompare(basename(b)));
const main = readFileSync(join(root, "main.js"), "utf8");
const calls = [...main.matchAll(/import \{ init as (\w+) \} from "\.\/([^"]+)"/g)].map((m) => [m[1], m[2]]);
const order = [...main.matchAll(/^(\w+)\(\);$/gm)].map((m) => m[1]);
const want = inits.join(","),
  got = calls.map((c) => c[1]).join(",");
if (want !== got)
  errors.push(`main.js must import init() from every numbered file, in file-number order:\n  ${inits.join("\n  ")}`);
if (order.join(",") !== calls.map((c) => c[0]).join(","))
  errors.push("main.js must call the inits in the order it imports them");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`src/js ok: ${files.length} modules, ${Object.keys(tops).length} top-level names, ${inits.length} inits`);
