/**
 * A markdown summary for agents (docs/04 §3).
 *
 * More and more recruiters paste the URL into an LLM and ask whether the
 * candidate is a fit. This is what that model reads. It is generated from the
 * dataset: writing it by hand guarantees that in three months it says something
 * different from the CV.
 */

import type { APIRoute } from "astro";
import { content, formatDateRange, formatRoleTitle, formatSeniority } from "@content";

export const GET: APIRoute = async ({ site }) => {
  const view = await content.getView("public-api", "es");
  const { identity } = view;
  const base = site?.toString().replace(/\/$/, "") ?? "";

  const lineas = [
    `# ${identity.fullName}`,
    "",
    `${identity.searchTitle} (${identity.brandTitle}) · ${formatSeniority(view.yearsOfExperience)} · ${identity.location.city}, ${identity.location.country} · ${identity.location.timezone}`,
    "",
    identity.summary.short,
    "",
    "## Contacto",
    `- Email: ${identity.contact.email}`,
    ...identity.links.map((l) => `- ${l.label}: ${l.url}`),
    `- CV en HTML: ${base}/cv`,
    `- CV en PDF: ${base}/cv.pdf`,
    `- Datos en JSON: ${base}/cv.json`,
    "",
    "## Stack",
    ...Object.entries(view.skills)
      .filter(([, list]) => list.length > 0)
      .map(([cat, list]) => `- ${cat}: ${list.map((s) => s.name).join(", ")}`),
    "",
    "## Experiencia",
    ...view.experience.flatMap((role) => [
      `### ${formatRoleTitle(role)} · ${role.clientDescription ? `${role.company} — ${role.clientDescription}` : role.company}`,
      `${formatDateRange(role.start, role.end)} · ${role.employmentType} · ${role.workMode}`,
      role.context.short,
      ...role.achievements.map((a) => `- ${a.text.short}`),
      "",
    ]),
    "## Proyectos",
    ...view.projects.flatMap((p) => [
      `### ${p.name}${p.client ? ` (${p.client})` : ""}`,
      p.problem.short,
      p.solution.short,
      ...(p.slug ? [`Caso: ${base}/projects/${p.slug}`] : []),
      "",
    ]),
  ];

  return new Response(lineas.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
