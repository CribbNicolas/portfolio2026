/**
 * The CI workflows are valid YAML and declare a trigger.
 *
 * This exists because of a real failure on 2026-08-25: a literal CR character
 * slipped into the middle of a line in `smoke-deploy.yml`. The parser read it
 * as a line break, the file stopped being valid YAML, and GitHub marked every
 * run as failed WITH NO JOBS. That is: the gate verifying the published PDF
 * went three commits without running, and from the Actions list it looked the
 * same as any other failure.
 *
 * That is the failure mode this check catches: a broken workflow does not
 * announce itself as broken, it announces itself as "something failed". And a
 * gate that does not run is worse than no gate, because it still gives the
 * feeling of being covered.
 *
 * It does NOT validate the GitHub Actions schema — that would need actionlint
 * and an external binary. It validates what actually breaks when editing these
 * files.
 *
 * The two layers are needed separately: measured on the real case, an embedded
 * CR does NOT always break the parser. Sometimes it breaks the YAML and
 * sometimes it only leaves a line that behaves differently from how it reads.
 * That is why the CR is also searched for by hand.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const DIR = ".github/workflows";
const files = readdirSync(DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

test("there are workflows to verify", () => {
  // If someone renames the directory, the other tests would pass by being empty.
  assert.ok(files.length > 0, `no workflow found in ${DIR}`);
});

for (const file of files) {
  const path = join(DIR, file);
  const raw = readFileSync(path, "utf8");

  test(`${file}: no stray CRs and no tabs`, () => {
    // A CR outside a CRLF pair splits the line for the YAML parser even though
    // it looks normal in the editor. It is exactly the bug that started this
    // check.
    const lines = raw.split(/\r?\n/);
    lines.forEach((line, i) => {
      assert.ok(
        !line.includes("\r"),
        `${path}:${i + 1} has a CR in the middle of the line: it splits the YAML invisibly`,
      );
      assert.ok(!line.includes("\t"), `${path}:${i + 1} has a tab; YAML does not allow tabs`);
    });
  });

  test(`${file}: parses as YAML`, () => {
    // The parser message carries line and column: it is propagated whole.
    assert.doesNotThrow(() => parse(raw), `${path} is not valid YAML`);
  });

  test(`${file}: declares jobs and a trigger`, () => {
    const doc = parse(raw) as Record<string, unknown> | null;
    assert.ok(doc && typeof doc === "object", `${path} does not define a map at the root`);

    // Verified: the `yaml` library uses the YAML 1.2 core schema, where `on` is
    // the string "on" and not the boolean true (that is YAML 1.1). The boolean
    // form is accepted anyway because it costs nothing, and the day the parser
    // changes the check does not become a silent false positive.
    const trigger = "on" in doc || "true" in doc;
    assert.ok(trigger, `${path} does not declare \`on:\``);

    const jobs = doc["jobs"];
    assert.ok(
      jobs && typeof jobs === "object" && Object.keys(jobs).length > 0,
      `${path} declares no jobs`,
    );
  });
}
