/**
 * Comparación de versiones. Funciones puras, sin I/O.
 *
 * Vive separado de `version-bump.check.ts` para que la lógica que decide si un
 * bump es válido se pueda testear sin un repo git alrededor.
 *
 * Se acepta SOLO `major.minor.patch` con enteros. Nada de prereleases ni
 * metadata (`1.0.0-rc.1`, `1.0.0+build`): son válidos en semver pero acá no
 * significarían nada —no hay canal de prerelease, no hay builds numerados— y
 * aceptarlos obligaría a definir cómo ordenan. Si algún día hace falta, se
 * agrega con su regla de orden explícita, no por descuido del parser.
 */

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

/** `null` si la cadena no es exactamente `x.y.z` con enteros no negativos. */
export function parsear(texto: string): Version | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(texto.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** <0 si a es anterior a b, 0 si son iguales, >0 si a es posterior. */
export function comparar(a: Version, b: Version): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export type Salto = "major" | "minor" | "patch" | "irregular";

/**
 * Qué clase de salto hay entre dos versiones.
 *
 * `irregular` es todo lo que sube pero no es UN escalón limpio: 0.1.0 → 0.3.0,
 * o 1.2.3 → 2.0.1. No es un error —a veces se salta a propósito— pero es la
 * firma de un typo, así que se reporta sin bloquear.
 */
export function salto(base: Version, nueva: Version): Salto {
  if (nueva.major === base.major + 1 && nueva.minor === 0 && nueva.patch === 0) return "major";
  if (nueva.major === base.major && nueva.minor === base.minor + 1 && nueva.patch === 0) {
    return "minor";
  }
  if (
    nueva.major === base.major &&
    nueva.minor === base.minor &&
    nueva.patch === base.patch + 1
  ) {
    return "patch";
  }
  return "irregular";
}

export interface Veredicto {
  ok: boolean;
  /** Explica el fallo, o describe el salto cuando pasa. Siempre se imprime. */
  motivo: string;
}

/**
 * La regla dura: la versión nueva tiene que ser ESTRICTAMENTE mayor que la de
 * la rama base.
 *
 * Igual no alcanza. Dos merges distintos a `staging` con el mismo número
 * significan que "la versión" dejó de identificar qué hay deployado, que es la
 * única cosa para la que sirve.
 */
export function verificarBump(baseTexto: string, nuevaTexto: string): Veredicto {
  const base = parsear(baseTexto);
  const nueva = parsear(nuevaTexto);

  if (!base) return { ok: false, motivo: `la versión de la rama base no es x.y.z: "${baseTexto}"` };
  if (!nueva) {
    return { ok: false, motivo: `la versión de package.json no es x.y.z: "${nuevaTexto}"` };
  }

  const orden = comparar(nueva, base);
  if (orden === 0) {
    return {
      ok: false,
      motivo:
        `package.json sigue en ${nuevaTexto}: este merge no sube la versión.\n` +
        `  Subila en el mismo PR. patch para un arreglo, minor para algo nuevo,\n` +
        `  major si algo que ya existía cambia de forma.`,
    };
  }
  if (orden < 0) {
    return {
      ok: false,
      motivo: `package.json (${nuevaTexto}) es ANTERIOR a la rama base (${baseTexto}): la versión bajó`,
    };
  }

  const clase = salto(base, nueva);
  if (clase === "irregular") {
    return {
      ok: true,
      motivo:
        `${baseTexto} → ${nuevaTexto}: sube, pero no es un escalón limpio.\n` +
        `  Si fue a propósito, ignorá esto. Si esperabas otro número, es un typo.`,
    };
  }
  return { ok: true, motivo: `${baseTexto} → ${nuevaTexto} (${clase})` };
}
