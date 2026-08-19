/**
 * ContentView → schema.org/Person.
 *
 * Server-rendered en el `<head>`: los crawlers no ejecutan JS, así que un
 * JSON-LD inyectado por script no existe para ellos (docs/04 §3).
 *
 * Se alimenta de la superficie `public-api`, que ya excluye los datos de
 * contacto privados. Este archivo no filtra nada: si tuviera que filtrar,
 * el filtro estaría en el lugar equivocado.
 */

// Import relativo y NO por el alias `@content`: este módulo lo cargan tanto Vite
// (que resuelve el alias) como `tsx` corriendo el test suelto (que puede no
// resolverlo). Es `import type`, así que no hay costo en runtime. Los `.astro`
// sí usan el alias, porque siempre pasan por Vite.
import type { ContentView } from "../../content/source/index";

export function buildPersonJsonLd(view: ContentView, site: URL): Record<string, unknown> {
  const { identity } = view;
  const rolActual = view.experience.find((r) => r.end === null);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    // `@id` estable: es lo que le permite a un agente unir esta página con los
    // perfiles de `sameAs` como una sola entidad. Si cambia, se pierde.
    "@id": new URL("/#person", site).toString(),
    name: identity.fullName,
    alternateName: identity.preferredName,
    // El buscable, no el de marca (CONTRATO §3).
    jobTitle: identity.searchTitle,
    description: identity.summary.short,
    url: site.toString(),
    email: identity.contact.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: identity.location.city,
      addressRegion: identity.location.region,
      addressCountry: identity.location.country,
    },
    knowsAbout: Object.values(view.skills)
      .flat()
      .filter((s) => s.level === "core" || s.level === "working")
      .map((s) => s.name),
    knowsLanguage: view.languages.map((l) => ({
      "@type": "Language",
      name: l.name,
      alternateName: l.code,
    })),
    ...(rolActual && {
      worksFor: { "@type": "Organization", name: rolActual.company },
    }),
    alumniOf: view.education.map((e) => ({
      "@type": "EducationalOrganization",
      name: e.institution,
    })),
    sameAs: identity.links.map((l) => l.url),
  };
}
