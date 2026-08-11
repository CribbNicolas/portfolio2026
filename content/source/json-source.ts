/**
 * Implementación de `ContentSource` sobre un JSON en el repo.
 *
 * Esta es la Fase 0. Cuando muevas los datos a Sanity o a un backend propio,
 * escribís otro archivo que implemente la misma interfaz y cambiás una línea
 * en `index.ts`. El frontend no se entera de nada.
 *
 * Esta clase NO resuelve visibility. Su única responsabilidad es traer y
 * cachear el dataset; toda la lógica de vista vive en `schema/resolve-view.ts`
 * y es compartida por todos los backends. Ver ese archivo antes de tocar filtros.
 */

import type {
  ContentDataset,
  ContentSource,
  ContentView,
  Locale,
  Project,
  Surface,
} from "../schema/content-schema";
import { validateDataset } from "../schema/validation";
import { resolveView } from "../schema/resolve-view";
import datasetEs from "../data/content.es.json";

/** Datasets disponibles por locale. Agregá content.en.json acá cuando exista. */
const DATASETS: Partial<Record<Locale, unknown>> = {
  es: datasetEs,
};

export class JsonContentSource implements ContentSource {
  private cache = new Map<Locale, ContentDataset>();

  async getDataset(locale: Locale): Promise<ContentDataset> {
    const cached = this.cache.get(locale);
    if (cached) return cached;

    const raw = DATASETS[locale];
    if (!raw) {
      // Falla fuerte y temprano. Devolver otro locale en silencio es peor que romper.
      throw new Error(
        `Locale no soportado: "${locale}". Datasets cargados: ${Object.keys(DATASETS).join(", ") || "ninguno"}.`,
      );
    }

    const data = validateDataset(raw);
    this.cache.set(locale, data);
    return data;
  }

  async getView(surface: Surface, locale: Locale): Promise<ContentView> {
    return resolveView(await this.getDataset(locale), surface);
  }

  async getProject(slug: string, locale: Locale): Promise<Project | null> {
    const data = await this.getDataset(locale);
    return data.projects.find((p) => p.slug === slug) ?? null;
  }
}
