/**
 * Markdown summary for agents (docs/04 §3). Shared by `/llms.txt` and
 * `/en/llms.txt` so the two cannot grow different headings.
 *
 * Every URL goes out as a Markdown link — `[name](url)` — and not as bare
 * text. That is what the llms.txt convention asks for, and it is checked:
 * Lighthouse 13's `llms-txt` audit failed this file with "File does not appear
 * to contain any links" while it was emitting `- GitHub: https://...`, which a
 * human reads perfectly well and a parser does not read at all.
 */

import type { ContentView, Locale } from "@content";
import { formatDateRange, formatRoleTitle, formatSeniority, groupedSkills, MESSAGES } from "@content";
import { LOCALE_PATHS } from "./anchors";

export function renderLlmsTxt(view: ContentView, locale: Locale, base: string): string {
  const { identity } = view;
  const m = MESSAGES[locale];
  const paths = LOCALE_PATHS[locale];

  const lines = [
    `# ${identity.fullName}`,
    "",
    `${identity.searchTitle} (${identity.brandTitle}) · ${formatSeniority(view.yearsOfExperience, locale)} · ${identity.location.city}, ${identity.location.country} · ${identity.location.timezone}`,
    "",
    identity.summary.short,
    "",
    `## ${m.llmsContact}`,
    // The address is repeated outside the link on purpose: `mailto:` is the
    // useful target for anything that acts, and the plain text is what
    // survives a reader that strips markup.
    `- [${m.emailLabel}](mailto:${identity.contact.email}): ${identity.contact.email}`,
    ...identity.links.map((l) => `- [${l.label}](${l.url})`),
    `- [${m.llmsHtmlCv}](${base}${paths.cv})`,
    `- [${m.llmsPdfCv}](${base}${paths.pdf})`,
    `- [${m.llmsJson}](${base}${paths.json})`,
    "",
    `## ${m.llmsStack}`,
    ...groupedSkills(view.skills, locale)
      .map(({ label, skills }) => `- ${label}: ${skills.map((s) => s.name).join(", ")}`),
    "",
    `## ${m.llmsExperience}`,
    ...view.experience.flatMap((role) => [
      `### ${formatRoleTitle(role, locale)} · ${role.clientDescription ? `${role.company} — ${role.clientDescription}` : role.company}`,
      `${formatDateRange(role.start, role.end, locale)} · ${role.employmentType} · ${role.workMode}`,
      role.context.short,
      ...role.achievements.map((a) => `- ${a.text.short}`),
      "",
    ]),
    `## ${m.llmsProjects}`,
    ...view.projects.flatMap((p) => [
      `### ${p.name}${p.client ? ` (${p.client})` : ""}`,
      p.problem.short,
      p.solution.short,
      // The dataset's own links, which this file used to drop entirely: a
      // public demo is the strongest thing an agent can be handed, and it was
      // reachable from the landing but not from the file written for agents.
      ...p.links.map((l) => `- [${l.label}](${l.url})`),
      ...(p.slug ? [`- [${m.llmsCase}](${base}/projects/${p.slug})`] : []),
      "",
    ]),
  ];

  return lines.join("\n");
}
