/**
 * El retraso de la barra flotante al desplazarse.
 *
 * La barra ya está fija y es usable sin este script: lo único que agrega es
 * que quede unos píxeles atrás mientras el scroll está en movimiento y vuelva
 * a su lugar al frenar. Es decoración, y por eso vive detrás de un guard de
 * `prefers-reduced-motion` y nunca toca el DOM más allá de un `transform`.
 *
 * `scrollY` se lee DENTRO del rAF y no en el listener. Los eventos de scroll
 * no están sincronizados con el repintado —llegan en ráfagas y a veces varios
 * entre dos frames— así que leerlos ahí producía saltos. El listener acá solo
 * despierta el loop; quien mide es el frame.
 *
 * El loop NO corre siempre: se apaga tras unos frames quieto. Un rAF
 * permanente por una animación de adorno gasta batería en un sitio que se lee.
 *
 * No importa nada de `@content` (regla 1 del frontend del mapa).
 */

/**
 * Cuánto se acerca al objetivo por frame. Más bajo = más pesada y más suave.
 * A 60fps, 0.075 tarda ~35 frames en cerrar el 93% de la distancia.
 */
const SEGUIMIENTO = 0.075;

/** Píxeles de desfase por píxel de diferencia. */
const AMPLITUD = 0.16;

/** Techo del desfase. Sin esto, un scroll con rueda rápida la manda a otra pantalla. */
const TOPE_PX = 16;

/** Debajo de este desfase en px no hay nada que ver: empieza a contar para frenar. */
const EPSILON_PX = 0.05;

/**
 * Frames quieto antes de apagar el loop. No cero: un scroll con inercia tiene
 * micro-pausas, y apagarse en la primera hacía que el próximo frame arrancara
 * de nuevo con un salto.
 */
const FRAMES_QUIETO = 10;

export function seguirScroll(el: HTMLElement): void {
  // Es adorno: para quien pidió menos movimiento, la barra queda quieta.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let actual = scrollY;
  let corriendo = false;
  let quietos = 0;

  const posar = (px: number): void => {
    el.style.transform = `translate3d(-50%, ${px.toFixed(2)}px, 0)`;
  };

  const paso = (): void => {
    // La medición va acá, no en el listener: es el único punto sincronizado
    // con el repintado.
    const objetivo = scrollY;
    actual += (objetivo - actual) * SEGUIMIENTO;

    const bruto = -(objetivo - actual) * AMPLITUD;
    const desfase = Math.max(-TOPE_PX, Math.min(TOPE_PX, bruto));

    if (Math.abs(desfase) < EPSILON_PX) {
      quietos += 1;
      if (quietos >= FRAMES_QUIETO) {
        // Vuelve al `transform` del CSS en vez de dejar un translate3d de 0:
        // así la barra no queda en una capa propia cuando no hay nada que
        // animar.
        actual = objetivo;
        el.style.transform = "";
        corriendo = false;
        return;
      }
    } else {
      quietos = 0;
    }

    posar(desfase);
    requestAnimationFrame(paso);
  };

  addEventListener(
    "scroll",
    () => {
      quietos = 0;
      if (corriendo) return;
      corriendo = true;
      requestAnimationFrame(paso);
    },
    { passive: true },
  );
}
