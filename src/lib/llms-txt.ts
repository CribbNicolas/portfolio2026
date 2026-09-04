/**
 * Markdown summary for agents (docs/04 §3). Shared by `/llms.txt` and
 * `/en/llms.txt` so the two cannot grow different headings.
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
    `- ${m.emailLabel}: ${identity.contact.email}`,
    ...identity.links.map((l) => `- ${l.label}: ${l.url}`),
    `- ${m.llmsHtmlCv}: ${base}${paths.cv}`,
    `- ${m.llmsPdfCv}: ${base}${paths.pdf}`,
    `- ${m.llmsJson}: ${base}${paths.json}`,
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
      ...(p.slug ? [`${m.llmsCase}: ${base}/projects/${p.slug}`] : []),
      "",
    ]),
  ];

  return lines.join("\n");
}
