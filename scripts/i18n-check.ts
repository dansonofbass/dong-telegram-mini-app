import { dictionaries, en } from "../src/i18n";
const canonical = Object.keys(en);
let failures = 0;
for (const [locale, dictionary] of Object.entries(dictionaries)) {
  const missing = canonical.filter(
    (key) =>
      !Object.hasOwn(dictionary, key) ||
      !dictionary[key as keyof typeof en]?.trim(),
  );
  const extra = Object.keys(dictionary).filter(
    (key) => !Object.hasOwn(en, key),
  );
  console.log(
    `${locale}: ${canonical.length} keys, ${missing.length} missing, ${extra.length} extra`,
  );
  if (missing.length || extra.length) {
    console.error({ missing, extra });
    failures++;
  }
}
if (failures) process.exitCode = 1;

if (process.argv.includes("--unused")) {
  const { readdirSync, readFileSync } = await import("node:fs");
  const ts = await import("typescript");
  const used = new Set<string>();
  function scan(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = dir + "/" + entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== "i18n") scan(path);
        continue;
      }
      if (!/\.tsx?$/.test(path)) continue;
      const file = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: import("typescript").Node) => {
        if (ts.isStringLiteral(node)) used.add(node.text);
        ts.forEachChild(node, visit);
      };
      visit(file);
    }
  }
  scan("src");
  console.log(
    "Potentially unused keys (review dynamic uses before removing):",
    canonical.filter((key) => !used.has(key)).join(", "),
  );
}
