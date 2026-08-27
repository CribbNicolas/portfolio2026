/**
 * Report of the dataset TODOs that reach a public output.
 *
 * It does NOT block the build, on purpose. These are pending data the author
 * knows about (metrics, project outcomes, English level), and a permanently red
 * pipeline stops carrying signal: by the third time nobody looks at it.
 *
 * What does block is a TODO reaching the PDF, and `scripts/pdf-output.check.ts`
 * verifies that, because the PDF is what gets sent.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const DIST = "dist";
const EXTENSIONS = [".html", ".json", ".txt"];

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry);
    if ((await stat(path)).isDirectory()) yield* walk(path);
    else if (EXTENSIONS.some((ext) => path.endsWith(ext))) yield path;
  }
}

let found = 0;

for await (const path of walk(DIST)) {
  const contents = await readFile(path, "utf8");
  contents.split("\n").forEach((line, i) => {
    if (!line.includes("TODO")) return;
    found++;
    console.log(`${path}:${i + 1}  ${line.trim().slice(0, 140)}`);
  });
}

console.log(
  found === 0
    ? "\nNo TODOs in the published outputs."
    : `\n${found} published TODO(s). Not blocking, but each one is a datum a reader will see.`,
);
