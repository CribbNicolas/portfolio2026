/**
 * ¿Este dispositivo puede correr la animación?
 *
 * Cuatro escalones, y solo el tercero mide de verdad. Los escalones 1 y 2 son
 * señales del navegador; el 3 es el reloj.
 *
 * Por qué importa la distinción: en iOS NO existen `saveData`, `effectiveType`
 * ni `deviceMemory` — son APIs de Chromium. Un guard que se apoye solo en ellas
 * está decidiendo a ciegas en la mitad de los teléfonos. Medir el frame es lo
 * único que funciona en todos lados.
 */

/** Frame time mediano por encima del cual se apaga. 20 ms ≈ 50 fps. */
export const PRESUPUESTO_MS = 20;
/** Cuántos frames se miden antes de decidir. A 60 fps, medio segundo. */
export const FRAMES_DE_PRUEBA = 30;

interface NavigatorExtendido extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

/** Escalón 1: se decide antes de bajar un solo byte del chunk 3D. */
export function puedeIntentar(): boolean {
  if (typeof window === "undefined") return false;

  // Una animación continua no es opcional para quien pidió menos movimiento.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

  // Sin WebGL2 no hay nada que intentar. Se chequea el constructor global en vez
  // de crear un contexto de prueba: crear contextos cuesta y hay tope por página.
  if (typeof WebGL2RenderingContext === "undefined") return false;

  const nav = navigator as NavigatorExtendido;

  // Modo ahorro de datos: bajar ~150 KB para decorar es exactamente lo que el
  // usuario pidió que no pase.
  if (nav.connection?.saveData === true) return false;

  const red = nav.connection?.effectiveType;
  if (red === "slow-2g" || red === "2g" || red === "3g") return false;

  // Estas dos existen solo en Chromium. `undefined` NO es motivo para bloquear:
  // si no sé, dejo que el escalón 3 mida.
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return false;
  if (navigator.hardwareConcurrency <= 2) return false;

  return true;
}

/**
 * Escalón 3: mide los primeros frames y avisa si no llega. El llamador apaga.
 *
 * Devuelve una función que hay que llamar en cada frame. Mientras junta
 * muestras devuelve `null`; cuando terminó devuelve `true` (sigue) o `false`
 * (apagar). Apagar no se ve: el SVG está pintado abajo desde el primer byte.
 */
export function medidorDeFrames(): (ahora: number) => boolean | null {
  const muestras: number[] = [];
  let previo = 0;

  return (ahora: number) => {
    if (previo === 0) { previo = ahora; return null; }
    const delta = ahora - previo;
    previo = ahora;

    // El primer frame tras el montaje incluye compilación de shaders y subida
    // de buffers. Medirlo sería medir el arranque, no el régimen.
    if (muestras.length === 0 && delta > 100) return null;

    muestras.push(delta);
    if (muestras.length < FRAMES_DE_PRUEBA) return null;

    const ordenadas = [...muestras].sort((a, b) => a - b);
    const mediana = ordenadas[Math.floor(ordenadas.length / 2)]!;
    return mediana <= PRESUPUESTO_MS;
  };
}
