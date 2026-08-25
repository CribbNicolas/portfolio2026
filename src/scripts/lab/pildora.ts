/**
 * La inercia de la barra flotante.
 *
 * La barra ya está fija y es usable sin este script: lo único que agrega es
 * peso al desplazarse. Es decoración, y por eso vive detrás de un guard de
 * `prefers-reduced-motion` y nunca toca el DOM más allá de un `transform`.
 *
 * El modelo es un **resorte amortiguado**, no una interpolación. Un lerp
 * exponencial (`actual += (objetivo - actual) * k`) solo sabe frenar: se
 * acerca al destino y nunca lo pasa, y eso el ojo lo lee como retraso, no como
 * masa. Un resorte subamortiguado se pasa de largo y vuelve, que es lo que
 * hace un objeto con peso colgado de algo que se mueve.
 *
 * La barra es la masa; la velocidad del scroll es lo que tira de ella. Al
 * frenar, el tirón desaparece, el resorte la trae de vuelta y la deja oscilar
 * una vez antes de asentarse.
 *
 * Dos detalles que son la diferencia entre "suave" y "tosco":
 *
 * 1. **Paso fijo.** La física corre a 60 Hz con un acumulador, no una vez por
 *    frame. Con paso variable, la misma constante de resorte da un movimiento
 *    en un monitor de 60 Hz y otro distinto en uno de 120 — y un frame largo
 *    puede volver la simulación inestable.
 * 2. **La velocidad del scroll se suaviza antes de entrar.** Los eventos de
 *    scroll llegan en ráfagas: la medición cruda salta entre 0 y 80 px de un
 *    frame al otro, y alimentar el resorte con eso le mete el ruido adentro.
 *
 * No importa nada de `@content` (regla 1 del frontend del mapa).
 */

/** El paso de la simulación. 60 Hz, independiente de los Hz de la pantalla. */
const PASO_MS = 1000 / 60;

/**
 * Cuánto tira el resorte hacia el objetivo, por paso. Más bajo = más pesada y
 * más lenta en reaccionar.
 */
const RIGIDEZ = 0.055;

/**
 * Cuánta velocidad conserva por paso. Es lo que decide si oscila o no:
 * 1 = oscila para siempre, ~0.7 = frena sin pasarse. 0.88 deja una sola
 * pasada de largo visible, que es lo que se lee como masa.
 */
const AMORTIGUACION = 0.88;

/** Píxeles de desfase por píxel/paso de velocidad de scroll. */
const AMPLITUD = 0.35;

/** Cuánto se promedia la velocidad medida. Más bajo = más suave y más tarde. */
const SUAVIZADO = 0.22;

/** Techo del desfase. Sin esto, un scroll con rueda rápida la manda a otra pantalla. */
const TOPE_PX = 22;

/** Debajo de esto no hay nada que ver: empieza a contar para frenar. */
const QUIETO_PX = 0.05;

/**
 * Pasos quieto antes de apagar el loop. No cero: un scroll con inercia tiene
 * micro-pausas, y apagarse en la primera hace que el siguiente frame arranque
 * con un salto.
 */
const PASOS_QUIETO = 12;

/**
 * Techo del delta. Una pestaña que vuelve del fondo trae un `dt` de segundos:
 * sin tope, el acumulador correría cientos de pasos de golpe y la barra
 * saltaría en vez de retomar.
 */
const DT_MAX_MS = 100;

export function seguirScroll(el: HTMLElement): void {
  // Es adorno: para quien pidió menos movimiento, la barra queda quieta.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let scrollAnterior = scrollY;
  /** Velocidad del scroll en px por paso, ya suavizada. Es lo que tira. */
  let tiron = 0;

  /** Posición y velocidad de la masa. */
  let y = 0;
  let vy = 0;

  let anterior = 0;
  let acumulado = 0;
  let quietos = 0;
  let corriendo = false;

  const paso = (): void => {
    const objetivo = Math.max(-TOPE_PX, Math.min(TOPE_PX, -tiron * AMPLITUD));
    // Resorte: acelera hacia el objetivo y pierde una fracción por rozamiento.
    vy += (objetivo - y) * RIGIDEZ;
    vy *= AMORTIGUACION;
    y += vy;

    if (Math.abs(y) < QUIETO_PX && Math.abs(vy) < QUIETO_PX && Math.abs(tiron) < QUIETO_PX) {
      quietos += 1;
    } else {
      quietos = 0;
    }
  };

  const frame = (ahora: number): void => {
    const dt = Math.min(ahora - anterior, DT_MAX_MS);
    anterior = ahora;

    // Una muestra por frame, normalizada a un paso de 60 Hz para que la
    // velocidad signifique lo mismo en cualquier pantalla.
    const bruta = dt > 0 ? ((scrollY - scrollAnterior) * PASO_MS) / dt : 0;
    scrollAnterior = scrollY;
    tiron += (bruta - tiron) * SUAVIZADO;

    acumulado = Math.min(acumulado + dt, DT_MAX_MS);
    while (acumulado >= PASO_MS) {
      paso();
      acumulado -= PASO_MS;
    }

    if (quietos >= PASOS_QUIETO) {
      // Vuelve al `transform` del CSS en vez de dejar un translate3d de 0: así
      // la barra no se queda en una capa propia cuando no hay nada que animar.
      y = 0;
      vy = 0;
      el.style.transform = "";
      corriendo = false;
      return;
    }

    el.style.transform = `translate3d(-50%, ${y.toFixed(2)}px, 0)`;
    requestAnimationFrame(frame);
  };

  addEventListener(
    "scroll",
    () => {
      quietos = 0;
      if (corriendo) return;
      corriendo = true;
      // Arrancar el reloj y la referencia acá: si no, el primer `dt` sería el
      // tiempo desde el último scroll —minutos, quizás— y el primer frame
      // mediría una velocidad absurda.
      anterior = performance.now();
      scrollAnterior = scrollY;
      acumulado = 0;
      requestAnimationFrame(frame);
    },
    { passive: true },
  );
}
