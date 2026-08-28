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

const dir = await mkdtemp(join(tmpdir(), "editor-page-"));
const file = join(dir, "content.es.json");
await writeFile(file, canonical, "utf8");

const server = createEditorServer(new DatasetStore(file));
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const problems: string[] = [];
page.on("pageerror", (err) => problems.push(String(err)));
page.on("console", (message) => {
  if (message.type() === "error") problems.push(message.text());
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
 */

/** The next `POST /api/validate` body: the dataset as the page holds it. */
const nextValidatedDataset = () =>
  page
    .waitForRequest((req) => req.url().endsWith("/api/validate") && req.method() === "POST")
    .then((req) => JSON.parse(req.postData() ?? "{}"));

test("typing through an absent optional object reaches the dataset", async () => {
  await page.getByRole("button", { name: "achievements" }).first().click();
  await page.locator(".nav__group", { hasText: "achievements" }).locator(".nav__item").first().click();
  // `metric` is absent on every achievement in the dataset — CLAUDE.md calls
  // the missing metrics the most important gap, and loading them is the reason
  // this editor exists.
  const label = page.locator('.field[data-path$="metric.label"] .control').first();
  await label.waitFor();

  const posted = nextValidatedDataset();
  await label.fill("tiempo de build");
  const dataset = await posted;

  const carrying = dataset.achievements.filter(
    (a: { metric?: { label?: string } }) => a.metric?.label === "tiempo de build",
  );
  assert.equal(carrying.length, 1, "the typed metric never reached the dataset the page holds");
  assert.deepEqual(problems, []);
});

test('"add" on an absent optional array creates the array instead of throwing', async () => {
  await page.getByRole("button", { name: "skills" }).first().click();
  await page.locator(".nav__group", { hasText: "skills" }).locator(".nav__item").first().click();
  // `periods` is optional and absent on every skill today, and the spec
  // advertises adding to it by name.
  const periods = page.locator("fieldset.group").filter({ hasText: /^periods \(\d+\)/ });
  await periods.waitFor();

  const posted = nextValidatedDataset();
  await periods.getByRole("button", { name: "add" }).click();
  const dataset = await posted;

  assert.equal(
    dataset.skills[0].periods?.length,
    1,
    "the added period never reached the dataset the page holds",
  );
  // The row is bound to a real path, not to the `?? []` the renderer invented.
  await page.waitForSelector('.field[data-path^="skills.0.periods.0."]');
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
