/**
 * `ContentSource` implementation over a JSON file in the repo.
 *
 * This is Phase 0. When the data moves to Sanity or to your own backend, you
 * write another file implementing the same interface and change one line in
 * `index.ts`. The frontend never notices.
 *
 * This class does NOT resolve visibility. Its only responsibility is fetching
 * and caching the dataset; all the view logic lives in `schema/resolve-view.ts`
 * and is shared by every backend. Read that file before touching filters.
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
import datasetEn from "../data/content.en.json";

/** Datasets available per locale. One file per language; the map is the index. */
const DATASETS: Partial<Record<Locale, unknown>> = {
  es: datasetEs,
  en: datasetEn,
};

export class JsonContentSource implements ContentSource {
  private cache = new Map<Locale, ContentDataset>();

  async getDataset(locale: Locale): Promise<ContentDataset> {
    const cached = this.cache.get(locale);
    if (cached) return cached;

    const raw = DATASETS[locale];
    if (!raw) {
      // Fail hard and early. Silently returning another locale is worse than
      // breaking.
      throw new Error(
        `Unsupported locale: "${locale}". Loaded datasets: ${Object.keys(DATASETS).join(", ") || "none"}.`,
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
