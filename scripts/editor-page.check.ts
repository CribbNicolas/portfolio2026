/**
 * The page, in a real browser, against a real server.
 *
 * The spec says the editor needs no UI tests, and this is not one: there are no
 * per-component assertions here. It is the one end-to-end pass that proves the
 * page loads, renders from the schema, and can actually save — because
 * `editor/public/` is the only code in this repo the compiler never sees, and a
 * page nobody has loaded is not known to work.
 *
 * It runs against a COPY of the dataset in a temp directory. The committed file
 * is never touched.
 *
 * Not a `*.test.ts`: it needs Chromium, like `pdf-output.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { chromium } from "playwright";

import { DatasetStore } from "../editor/store";
import { createEditorServer } from "../editor/server";

const canonical = (await readFile("content/data/content.es.json", "utf8")).replace(/\r\n/g, "\n");

/**
 * The two optional-path tests below need a target that is genuinely ABSENT: the
 * dataset already carries loaded metrics and skills with `periods`, and typing
 * into one of those exercises "edit an existing object", not "create a missing
 * one" — which is the defect they exist to catch. The target is read from the
 * data, so loading the next metric does not quietly turn the test into a no-op.
 */
const DATA = JSON.parse(canonical) as {
  achievements: Array<{ id: string; metric?: unknown }>;
  skills: Array<{ id: string; periods?: unknown[] }>;
};
const NO_METRIC = DATA.achievements.findIndex((a) => !a.metric);
const NO_PERIODS = DATA.skills.findIndex((s) => !s.periods);

const dir = await mkdtemp(join(tmpdir(), "editor-page-"));
const file = join(dir, "content.es.json");
await writeFile(file, canonical, "utf8");

const server = createEditorServer(new DatasetStore(file));
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("dialog", (dialog) => dialog.accept());

const problems: string[] = [];
page.on("pageerror", (err) => problems.push(String(err)));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text();
  // Chromium logs failed fetches as console errors. A 409 is the app's
  // stale-etag path and is asserted by name; it is not a page error.
  if (text.includes("409")) return;
  problems.push(text);
});

await page.goto(base);
// Waited on something only the APP can produce. `#status` ships with
// `loading…` already in it, so `#status:not(:empty)` was satisfied by the
// static HTML alone — every assertion below would have raced `app.js`'s first
// fetch, and a page that never loaded would still have passed the load test.
await page.waitForSelector(".nav__group");

test("the page loads with no console errors", () => {
  // A module that fails to parse, a wrong content-type, a typo in a selector:
  // all of them land here and nowhere else, since none of this is typechecked.
  assert.deepEqual(problems, []);
});

test("the sidebar is built from the dataset, not hard-coded", async () => {
  const skills = page.locator(".nav__group", { hasText: "skills" }).first();
  assert.match(await skills.innerText(), /typescript/);
});

test("top-level scalars are reachable from the header nav", async () => {
  await page.getByRole("button", { name: "header" }).click();
  await page.waitForSelector('.field[data-path="schemaVersion"]');
  await page.waitForSelector('.field[data-path="locale"]');
  await page.waitForSelector('.field[data-path="updatedAt"]');
});

test("a field renders from its descriptor, and a hint turns roleId into a picker", async () => {
  await page.getByRole("button", { name: "achievements" }).first().click();
  await page.locator(".nav__group", { hasText: "achievements" }).locator(".nav__item").first().click();
  await page.waitForSelector('.field[data-path$="roleId"] select');

  const options = await page.locator('.field[data-path$="roleId"] select option').allInnerTexts();
  assert.ok(options.includes("dinkum"), `expected the roles as options, got ${options.join(", ")}`);
});

test("an edit reaches the file through save", async () => {
  const field = page.locator('.field[data-path$="text.short"] .control').first();
  await field.fill("Texto editado por el smoke.");
  await page.waitForFunction(() => !(document.getElementById("save") as HTMLButtonElement).disabled);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForFunction(() => document.getElementById("status")?.textContent === "saved");

  const onDisk = await readFile(file, "utf8");
  assert.match(onDisk, /Texto editado por el smoke\./);
  assert.notEqual(
    JSON.parse(onDisk).updatedAt,
    JSON.parse(canonical).updatedAt,
    "a real edit has to stamp updatedAt, otherwise the field keeps lying",
  );
});

test("the saved file is still canonical, so the format gate stays green", async () => {
  const { serializeDataset } = await import("../editor/serialize");
  const onDisk = (await readFile(file, "utf8")).replace(/\r\n/g, "\n");
  assert.equal(onDisk, serializeDataset(JSON.parse(onDisk)));
});

/**
 * The one defect this smoke must never miss again.
 *
 * The renderer draws an ABSENT optional as an editable control, so these two
 * paths are reachable by design. Before the fix in `state.js` the listener threw
 * before `scheduleValidate()` ran: the typed text stayed on screen, Save kept
 * the enabled state the last good validation left it, and the save wrote the
 * dataset WITHOUT the edit while reporting "saved".
 *
 * What is asserted is the body of `POST /api/validate` — the dataset the page
 * actually holds — and not the DOM: the control showed the typed text either
 * way, which is precisely how the loss stayed invisible.
 *
 * The two tests below must follow "an edit reaches the file through save" because
 * typing a bare `metric.label` creates an invalid `metric: { label: "…" }` that
 * fails validation (it is `.strict()` and requires `confidence`), which blocks Save.
 */

/** The next `POST /api/validate` body: the dataset as the page holds it. */
const nextValidatedDataset = () =>
  page
    .waitForRequest((req) => req.url().endsWith("/api/validate") && req.method() === "POST")
    .then((req) => JSON.parse(req.postData() ?? "{}"));

test("typing through an absent optional object reaches the dataset", async () => {
  // Most achievements still have no `metric` — CLAUDE.md calls the missing
  // metrics the open gap, and loading them is the reason this editor exists.
  assert.notEqual(NO_METRIC, -1, "every achievement carries a metric now: pick another absent optional");
  await page.getByRole("button", { name: "achievements" }).first().click();
  await page
    .locator(".nav__group", { hasText: "achievements" })
    .locator(".nav__item")
    .filter({ hasText: new RegExp(`^${DATA.achievements[NO_METRIC]!.id}$`) })
    .click();
  const label = page.locator(`.field[data-path="achievements.${NO_METRIC}.metric.label"] .control`);
  await label.waitFor();

  const posted = nextValidatedDataset();
  await label.fill("tiempo de build");
  const dataset = await posted;

  assert.equal(
    dataset.achievements[NO_METRIC].metric?.label,
    "tiempo de build",
    "the typed metric never reached the dataset the page holds",
  );
  assert.deepEqual(problems, []);
});

test("clearing a typed-in optional object drops it from the dataset", async () => {
  const label = page.locator(`.field[data-path="achievements.${NO_METRIC}.metric.label"] .control`);
  const posted = nextValidatedDataset();
  await label.fill("");
  const dataset = await posted;
  assert.equal(
    dataset.achievements[NO_METRIC].metric,
    undefined,
    "empty metric was left on the dataset",
  );
  assert.deepEqual(problems, []);
});

test("an unreferenced collection item can be removed", async () => {
  const original = JSON.parse(canonical).skills.length;
  await page.getByRole("button", { name: "skills" }).first().click();
  await page.getByRole("button", { name: "add skills" }).click();
  await page.getByRole("button", { name: "remove this item" }).waitFor();

  const posted = nextValidatedDataset();
  await page.getByRole("button", { name: "remove this item" }).click();
  const dataset = await posted;
  assert.equal(dataset.skills.length, original);
  assert.deepEqual(problems, []);
});

test("removing a referenced skill is refused and listed", async () => {
  await page.getByRole("button", { name: "skills" }).first().click();
  await page
    .locator(".nav__group", { hasText: "skills" })
    .locator(".nav__item")
    .filter({ hasText: "typescript" })
    .click();
  await page.getByRole("button", { name: "remove this item" }).click();

  const panel = page.locator("#problems");
  assert.equal(await panel.isHidden(), false);
  const text = await panel.innerText();
  assert.match(text, /typescript/);
  assert.match(text, /skillIds/);
  assert.match(
    await page.locator(".nav__group", { hasText: "skills" }).innerText(),
    /typescript/,
  );
});

test("a 409 latches Save, and a keystroke does not re-enable it", async () => {
  const onDisk = JSON.parse(await readFile(file, "utf8"));
  onDisk.identity.preferredName = "changed-on-disk";
  const { serializeDataset } = await import("../editor/serialize");
  await writeFile(file, serializeDataset(onDisk), "utf8");

  await page.getByRole("button", { name: "identity" }).click();
  const name = page.locator('.field[data-path="identity.preferredName"] .control');
  await name.waitFor();
  await name.fill("Nico-stale");
  await page.waitForFunction(() => !(document.getElementById("save") as HTMLButtonElement).disabled);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForFunction(() =>
    document.getElementById("status")?.textContent?.includes("reload"),
  );
  assert.equal(await page.locator("#save").isDisabled(), true);

  const posted = nextValidatedDataset();
  await name.fill("Nico-stale-2");
  await posted;
  assert.equal(await page.locator("#save").isDisabled(), true);
  assert.match(await page.locator("#status").innerText(), /reload/);
  assert.deepEqual(problems, []);
});

test('"add" on an absent optional array creates the array instead of throwing', async () => {
  // `periods` is optional, and the spec advertises adding to it by name. The
  // skill has to be one that has none: on a skill that already carries them,
  // "add" appends and never exercises the absent-array path.
  assert.notEqual(NO_PERIODS, -1, "every skill carries periods now: pick another absent optional");
  await page.getByRole("button", { name: "skills" }).first().click();
  await page
    .locator(".nav__group", { hasText: "skills" })
    .locator(".nav__item")
    .filter({ hasText: new RegExp(`^${DATA.skills[NO_PERIODS]!.id}$`) })
    .click();
  const periods = page.locator("fieldset.group").filter({ hasText: /^periods \(\d+\)/ });
  await periods.waitFor();

  const posted = nextValidatedDataset();
  await periods.getByRole("button", { name: "add" }).click();
  const dataset = await posted;

  assert.equal(
    dataset.skills[NO_PERIODS].periods?.length,
    1,
    "the added period never reached the dataset the page holds",
  );
  // The row is bound to a real path, not to the `?? []` the renderer invented.
  await page.waitForSelector(`.field[data-path^="skills.${NO_PERIODS}.periods.0."]`);
  assert.deepEqual(problems, []);
});

test("no page error was raised by any of the interactions above", () => {
  // The first assertion of `problems` runs before a single click. Everything
  // this smoke actually exercises — navigating, typing, adding, saving —
  // happens after it, and an exception from any of it was collected here and
  // never read. This is the read.
  assert.deepEqual(problems, []);
});

test.after(async () => {
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});
