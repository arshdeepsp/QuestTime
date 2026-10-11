/* Checks the src/js layout rules the build relies on (run by npm test and npm run check:js):
   - file names are unique across folders (the build orders by file name, not by folder);
   - a numbered file (NN-… or NNx-…) may run code at startup, in number order;
   - an unnumbered file holds only function declarations (hoisted, so its position in the joined script doesn't matter);
   - no function name is declared twice (the later one would silently win). */
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
const errors = [],
  names = {},
  fns = {};
for (const f of files) {
  const b = basename(f),
    rel = relative(root, f);
  if (names[b]) errors.push(`${rel}: same file name as ${names[b]}`);
  names[b] = rel;
  const body = babel.parsers.babel.parse(readFileSync(f, "utf8"), {}).program.body;
  const numbered = /^\d\d[a-z]?-/.test(b);
  for (const n of body) {
    if (n.type === "FunctionDeclaration") {
      if (fns[n.id.name]) errors.push(`${rel}: function ${n.id.name} is also declared in ${fns[n.id.name]}`);
      fns[n.id.name] = rel;
    } else if (!numbered)
      errors.push(
        `${rel}: unnumbered files may only declare functions (found ${n.type} on line ${n.loc.start.line}); move it to a numbered file`,
      );
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`src/js ok: ${files.length} files, ${Object.keys(fns).length} functions`);
