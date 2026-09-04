/**
 * ContentView → schema.org/Person.
 *
 * Server-rendered in the `<head>`: crawlers do not execute JS, so a
 * JSON-LD inyectado por script no existe para ellos (docs/04 §3).
 *
 * Se alimenta de la superficie `public-api`, que ya excluye los datos de
 * contacto privados. Este archivo no filtra nada: si tuviera que filtrar,
 * the filter would be in the wrong place.
 */

// Relative import and NOT the `@content` alias: this module is loaded both by Vite
// (que resuelve el alias) como `tsx` corriendo el test suelto (que puede no
// resolve it). It is an `import type`, so there is no runtime cost. The
// `.astro` files do use the alias, because they always go through Vite.
import type { ContentView } from "../../content/source/index";

export function buildPersonJsonLd(view: ContentView, site: URL): Record<string, unknown> {
  const { identity } = view;
  const rolActual = view.experience.find((r) => r.end === null);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    // A stable `@id`: it is what lets an agent join this page with the
    // perfiles de `sameAs` como una sola entidad. Si cambia, se pierde.
    "@id": new URL("/#person", site).toString(),
    name: identity.fullName,
    alternateName: identity.preferredName,
    // The searchable one, not the brand one (CONTRACT §3).
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
