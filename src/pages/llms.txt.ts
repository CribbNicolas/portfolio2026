/**
 * Resumen en markdown para agentes (docs/04 §3).
 *
 * Cada vez más reclutadores pegan la URL en un LLM y preguntan si el candidato
 * sirve. Esto es lo que ese modelo lee. Se genera del dataset: escribirlo a
 * mano garantiza que en tres meses diga otra cosa que el CV.
 */

import type { APIRoute } from "astro";
import { content, formatDateRange, formatSeniority } from "@content";

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
      `### ${role.company} — ${role.displayTitle ?? role.title}`,
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
      ...(p.slug ? [`Caso: ${base}/proyectos/${p.slug}`] : []),
      "",
    ]),
  ];

  return new Response(lineas.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
