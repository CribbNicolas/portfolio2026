/**
 * El retraso de la píldora al desplazarse.
 *
 * La píldora ya está fija y es usable sin este script: lo único que agrega es
 * que quede unos píxeles atrás mientras el scroll está en movimiento y vuelva
 * a su lugar al frenar. Es decoración, y por eso vive detrás de un guard de
 * `prefers-reduced-motion` y nunca toca el DOM más allá de un `transform`.
 *
 * El `requestAnimationFrame` NO corre siempre: arranca con el scroll y se
 * apaga solo cuando la diferencia se hace imperceptible. Un loop permanente
 * por una animación de adorno gasta batería en un sitio que se lee, no se usa.
 *
 * No importa nada de `@content` (regla 1 del frontend del mapa).
 */

/** Cuánto se acerca al objetivo por frame. Más bajo = más pesada. */
const SEGUIMIENTO = 0.12;

/** Píxeles de retraso por unidad de diferencia. */
const AMPLITUD = 0.18;

/** Techo del desfase. Sin esto, un scroll con rueda rápida la manda a otra pantalla. */
const TOPE_PX = 18;

/** Debajo de esto la diferencia no se ve: se cierra el loop en vez de seguir. */
const EPSILON = 0.15;

export function seguirScroll(el: HTMLElement): void {
  // Es adorno: para quien pidió menos movimiento, la píldora queda quieta.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let actual = scrollY;
  let objetivo = scrollY;
  let corriendo = false;

  const paso = (): void => {
    actual += (objetivo - actual) * SEGUIMIENTO;
    const diferencia = objetivo - actual;

    if (Math.abs(diferencia) < EPSILON) {
      actual = objetivo;
      el.style.transform = "";
      corriendo = false;
      return;
    }

    const desfase = Math.max(-TOPE_PX, Math.min(TOPE_PX, -diferencia * AMPLITUD));
    el.style.transform = `translate(-50%, ${desfase.toFixed(2)}px)`;
    requestAnimationFrame(paso);
  };

  addEventListener(
    "scroll",
    () => {
      objetivo = scrollY;
      if (corriendo) return;
      corriendo = true;
      requestAnimationFrame(paso);
    },
    { passive: true },
  );
}
