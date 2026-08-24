/**
 * El puente lista↔mapa.
 *
 * No conoce three ni el markup: es un `EventTarget` con dos métodos. Por eso el
 * renderer se puede cambiar sin tocar el DOM, y al revés.
 *
 * Ojo: en CSS el hover cruzado YA funciona sin JavaScript (`lab-hover-css.ts`).
 * Esto existe para el lado que el CSS no puede hacer — resaltar un nodo dentro
 * del canvas WebGL, donde no hay elementos ni `:hover`.
 */

export type FuenteHover = "dom" | "canvas";
export type OyenteHover = (id: string | null, fuente: FuenteHover) => void;

export interface BusHover {
  activar(id: string | null, fuente: FuenteHover): void;
  alCambiar(fn: OyenteHover): () => void;
  actual(): string | null;
}

export function crearBusHover(): BusHover {
  const oyentes = new Set<OyenteHover>();
  let activo: string | null = null;

  return {
    activar(id, fuente) {
      // La deduplicación es lo que impide el loop: los dos lados escuchan y
      // emiten, así que sin esto un hover rebota indefinidamente.
      if (id === activo) return;
      activo = id;
      for (const fn of oyentes) fn(id, fuente);
    },
    alCambiar(fn) {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    actual: () => activo,
  };
}
