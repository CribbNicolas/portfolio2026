/**
 * The two surfaces agents consume, and the only two that had no gate.
 *
 * `/cv` has eleven tests over the PDF, the landing has nine checks, the bundle
 * has a budget. `/cv.json` and `/llms.txt` had nothing — and a real
 * `formatRoleTitle` bug already got through into `llms.txt` once, recorded in
 * PR #1 (`07-technical-debt.md` §8).
 *
 * What is verified here is what breaks silently: JSON that stops parsing, a
 * contract key that disappears, and text assembled from a field that came back
 * empty. None of it shows up as an error — the endpoint answers 200 with
 * something useless.
 *
 * The name does NOT end in `.test.ts` on purpose: it reads `dist/`, so it needs
 * a prior build. Same reason as `pdf-output.check.ts` and
 * `single-landing.check.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { content, formatRoleTitle, groupedSkills, MESSAGES } from "../content/source/index";
import { LOCALE_PATHS } from "../src/lib/anchors";

const DIST = "dist";

async function readDist(urlPath: string): Promise<string> {
  // `/cv.json` → `dist/cv.json`; `/en/llms.txt` → `dist/en/llms.txt`.
  return readFile(join(DIST, ...urlPath.replace(/^\//, "").split("/")), "utf8");
}

const rawJsonEs = await readDist(LOCALE_PATHS.es.json);
const rawJsonEn = await readDist(LOCALE_PATHS.en.json);
const llmsEs = await readDist(LOCALE_PATHS.es.llms);
const llmsEn = await readDist(LOCALE_PATHS.en.llms);

// ---------------------------------------------------------------------------
// /cv.json
// ---------------------------------------------------------------------------

function parseJson(raw: string, label: string): Record<string, unknown> {
  assert.doesNotThrow(() => JSON.parse(raw), `${label} is not valid JSON`);
  return JSON.parse(raw) as Record<string, unknown>;
}

const cvEs = parseJson(rawJsonEs, LOCALE_PATHS.es.json);
const cvEn = parseJson(rawJsonEn, LOCALE_PATHS.en.json);

const CONTRACT_KEYS = [
  "surface", "locale", "identity", "experience", "projects", "skills",
  "education", "certifications", "languages", "services", "testimonials",
  "yearsOfExperience",
];

for (const [locale, cv, path] of [
  ["es", cvEs, LOCALE_PATHS.es.json],
  ["en", cvEn, LOCALE_PATHS.en.json],
] as const) {
  test(`${path} carries the keys the contract promises`, () => {
    const missing = CONTRACT_KEYS.filter((k) => !(k in cv));
    assert.deepEqual(missing, [], `${path} is missing: ${missing.join(", ")}`);
  });

  test(`${path} is the public-api surface in ${locale}`, () => {
    assert.equal(cv.surface, "public-api", `${path} declares surface "${cv.surface}"`);
    assert.equal(cv.locale, locale, `${path} declares locale "${cv.locale}"`);
  });

  test(`rule 8: ${path} publishes neither phone nor street address`, async () => {
    const identity = cv.identity as Record<string, Record<string, unknown>>;
    assert.equal(identity.contact.phone, undefined, `the phone number is in ${path}`);
    assert.equal(identity.location.streetAddress, undefined, `the street address is in ${path}`);

    const data = await content.getDataset(locale);
    if (data.identity.contact.phone) {
      assert.notEqual(
        JSON.stringify(cv).includes(data.identity.contact.phone),
        true,
        `the dataset's phone number appears somewhere in ${path}`,
      );
    }
  });

  test(`${path} says the same as the view it comes from`, async () => {
    const view = await content.getView("public-api", locale);
    assert.equal((cv.experience as unknown[]).length, view.experience.length);
    assert.equal((cv.projects as unknown[]).length, view.projects.length);
    assert.equal(cv.yearsOfExperience, view.yearsOfExperience);
  });
}

// ---------------------------------------------------------------------------
// /llms.txt
// ---------------------------------------------------------------------------

for (const [locale, llms, path] of [
  ["es", llmsEs, LOCALE_PATHS.es.llms],
  ["en", llmsEn, LOCALE_PATHS.en.llms],
] as const) {
  const m = MESSAGES[locale];

  test(`${path} has the sections an agent looks for`, () => {
    for (const heading of [
      "# ",
      `## ${m.llmsContact}`,
      `## ${m.llmsStack}`,
      `## ${m.llmsExperience}`,
      `## ${m.llmsProjects}`,
    ]) {
      assert.ok(llms.includes(heading), `${path} is missing the "${heading.trim()}" section`);
    }
  });

  test(`${path} carries its URLs as Markdown links`, () => {
    // Lighthouse 13's `llms-txt` audit failed this file with "File does not
    // appear to contain any links" while it happily emitted
    // `- GitHub: https://github.com/…`. A human reads that fine; a parser
    // looking for `[name](url)` reads nothing at all. This asserts the shape
    // the convention asks for, and that no bare URL sneaks back into a list
    // item — which is how the regression would look.
    const links = llms.match(/\[[^\]]+\]\((https?:\/\/|mailto:)[^)]+\)/g) ?? [];
    assert.ok(
      links.length >= 5,
      `${path} has ${links.length} Markdown links. The contact block alone should ` +
        "carry the mail, both profiles, the HTML CV, the PDF and the JSON.",
    );

    const bare = llms
      .split(/\r?\n/)
      .filter((line) => /^-\s/.test(line) && /https?:\/\//.test(line) && !/\]\(/.test(line));
    assert.deepEqual(bare, [], `${path} lists a bare URL instead of a Markdown link: ${bare.join(" | ")}`);
  });

  test(`${path} has no empty fields`, () => {
    const offenders = llms
      .split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /^(-|###?)\s*[^:]*:\s*$/.test(line) || /:\s*(undefined|null)\b/.test(line))
      .map(([n, line]) => `${n}: ${line.trim()}`);

    assert.deepEqual(offenders, [], `${path} has empty or undefined fields:\n  ${offenders.join("\n  ")}`);
  });

  test(`${path} prints role titles whole`, async () => {
    const view = await content.getView("public-api", locale);
    for (const role of view.experience) {
      const title = formatRoleTitle(role, locale);
      assert.ok(llms.includes(title), `the role title "${title}" does not appear whole in ${path}`);
    }
  });

  test(`${path} groups the skills the same way the CV does`, async () => {
    const view = await content.getView("public-api", locale);
    for (const { label, skills } of groupedSkills(view.skills, locale)) {
      assert.ok(llms.includes(`- ${label}: `), `${path} does not print the "${label}" group`);
      assert.ok(llms.includes(skills[0]!.name), `"${skills[0]!.name}" is missing from the "${label}" group`);
    }
  });

  test(`no dataset TODO reaches ${path} as a bare field`, () => {
    const offenders = llms
      .split("\n")
      .filter((line) => /^(###?|-\s*[^:]+:)\s*TODO/.test(line.trim()));
    assert.deepEqual(offenders, [], `${path} has TODO as a whole field:\n  ${offenders.join("\n  ")}`);
  });
}

test("the English llms.txt is not a Spanish file under an English URL", () => {
  assert.equal(llmsEn.includes(`## ${MESSAGES.es.llmsExperience}`), false);
  assert.ok(llmsEn.includes(`## ${MESSAGES.en.llmsExperience}`));
});
