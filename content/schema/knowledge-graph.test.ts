/**
 * Lo que el schema NO puede validar del grafo: integridad referencial del
 * resultado, determinismo del layout, y que ningún TODO del dataset se filtre
 * a un tooltip.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { content } from "../source/index";
import {
  buildKnowledgeGraph, nodosSinEvidencia, afinidadDeSkills, aniosDeSkill,
  ESCALA_RADIO_MIN, ESCALA_RADIO_MAX,
} from "./knowledge-graph";
import { monthsBetween } from "./dates";
import { layoutGraph, projectGraph } from "./graph-layout";

const view = await content.getView("portfolio", "es");
const graph = buildKnowledgeGraph(view);

test("todo nodo tiene id namespaced y único", () => {
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    assert.match(n.id, /^(skill|role|project|achievement):.+/, `id sin namespace: ${n.id}`);
    assert.ok(!ids.has(n.id), `id duplicado: ${n.id}`);
    ids.add(n.id);
  }
});

test("regla dura: ninguna arista apunta a un nodo inexistente", () => {
  // Si esto falla, el layout opera sobre undefined y el grafo explota sin
  // mensaje útil. `resolveView` filtra skills por `active`, así que la
  // situación es real, no teórica.
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const e of graph.edges) {
    assert.ok(ids.has(e.source), `arista huérfana, source: ${e.source}`);
    assert.ok(ids.has(e.target), `arista huérfana, target: ${e.target}`);
  }
});

test("ningún tooltip arranca con un TODO del dataset", () => {
  // `Project.problem` y `Project.outcome` todavía tienen TODO en 2 de 3
  // proyectos. Por eso el builder usa `solution.short`. Este test es lo que
  // convierte esa elección frágil en una regla.
  for (const n of graph.nodes) {
    assert.ok(n.detail.length > 0, `detail vacío en ${n.id}`);
    assert.ok(!n.detail.trimStart().startsWith("TODO"), `TODO filtrado en ${n.id}: ${n.detail}`);
  }
});

test("el grado se calcula del grafo, no del dataset", () => {
  const esperado = new Map(graph.nodes.map((n) => [n.id, 0]));
  for (const e of graph.edges) {
    esperado.set(e.source, esperado.get(e.source)! + 1);
    esperado.set(e.target, esperado.get(e.target)! + 1);
  }
  for (const n of graph.nodes) assert.equal(n.degree, esperado.get(n.id));
});

test("afinidad: solo pares que comparten una fuente real", () => {
  const pares = afinidadDeSkills(view);
  for (const p of pares) {
    assert.ok(p.weight >= 1, `peso inválido en ${p.a}|${p.b}`);
    assert.notEqual(p.a, p.b, "una skill no puede tener afinidad consigo misma");
  }
  // Sin duplicados: el par se normaliza alfabéticamente antes de agrupar.
  const claves = pares.map((p) => `${p.a}|${p.b}`);
  assert.equal(new Set(claves).size, claves.length, "par de afinidad duplicado");
});

test("afinidad: toda skill de una arista de afinidad tiene evidencia", () => {
  // Una skill sin logros no puede co-ocurrir con nada. Si aparece acá, la
  // derivación está leyendo de donde no debe.
  const sinEvidencia = new Set(nodosSinEvidencia(graph).map((n) => n.id));
  for (const e of graph.edges.filter((x) => x.kind === "afinidad")) {
    assert.ok(!sinEvidencia.has(e.source), `afinidad desde nodo sin evidencia: ${e.source}`);
    assert.ok(!sinEvidencia.has(e.target), `afinidad hacia nodo sin evidencia: ${e.target}`);
  }
});

test("el orden de emisión es estable entre corridas", () => {
  // El layout siembra las posiciones por índice de nodo: otro orden es otro
  // mapa. Esto es lo que hace que el determinismo del layout sea real.
  const otra = buildKnowledgeGraph(view);
  assert.deepEqual(
    otra.nodes.map((n) => n.id),
    graph.nodes.map((n) => n.id),
  );
});

test("el layout es determinista", () => {
  const a = layoutGraph(buildKnowledgeGraph(view));
  const b = layoutGraph(buildKnowledgeGraph(view));
  assert.deepEqual(a.nodes, b.nodes, "dos corridas del layout dieron distinto");
  assert.equal(a.radioEncuadre, b.radioEncuadre);
});

test("`sinEvidencia` es exactamente \"no tiene evidencia\"", () => {
  // Lo consume el `<svg>` para dibujar esos nodos distinto. Si se desincroniza
  // del grado, el mapa miente sobre qué está respaldado.
  const positioned = layoutGraph(graph);
  for (const n of positioned.nodes) {
    assert.equal(n.sinEvidencia, n.degree === 0, `${n.id} mal clasificado`);
  }
});

test("el encuadre no depende del tamaño del dataset", () => {
  // La normalización es lo que impide que sumar un logro cambie el zoom de toda
  // la página. Se verifica sobre el percentil, que es lo que se normaliza.
  const { nodes } = layoutGraph(graph);
  const cuerpo = nodes
    .filter((n) => !n.sinEvidencia)
    .map((n) => Math.hypot(n.x, n.y, n.z))
    .sort((a, b) => a - b);
  const p85 = cuerpo[Math.floor(cuerpo.length * 0.85)]!;
  assert.ok(Math.abs(p85 - 300) < 1, `el cuerpo no quedó normalizado a 300 (dio ${p85.toFixed(1)})`);
});

test("el layout no degenera: los nodos ocupan volumen en los tres ejes", () => {
  const { nodes } = layoutGraph(graph);
  for (const eje of ["x", "y", "z"] as const) {
    const vs = nodes.map((n) => n[eje]);
    const rango = Math.max(...vs) - Math.min(...vs);
    assert.ok(rango > 100, `el eje ${eje} colapsó (rango ${rango.toFixed(1)})`);
  }
});

test("la proyección produce perspectiva real", () => {
  // Sin variación de escala el dibujo es plano y todo el concepto se cae.
  const proyectado = projectGraph(layoutGraph(graph));
  const escalas = proyectado.map((p) => p.escala);
  const min = Math.min(...escalas);
  const max = Math.max(...escalas);
  assert.ok(min > 0, "escala no positiva: hay un nodo detrás de la cámara");
  assert.ok(max / min > 1.3, `perspectiva insuficiente (${(max / min).toFixed(2)}×)`);
});

// ---------------------------------------------------------------------------
// TAMAÑO: peso = años × conexiones
// ---------------------------------------------------------------------------

test("aniosDeSkill: declared `periods` are UNIONed with the evidence, not a replacement", () => {
  const anios = aniosDeSkill(view);
  // React declares a period from 2022-10, but the evidence starts earlier:
  // AdsMovil (2022-06), still open at Dinkum. A declared period ADDS what no
  // achievement records; it never erases real evidence.
  const withEvidence = monthsBetween("2022-06", null) / 12;
  assert.ok(
    Math.abs(anios.get("react")! - withEvidence) < 0.01,
    `the declared period hid the evidence: ${anios.get("react")} vs ${withEvidence}`,
  );
});

test("aniosDeSkill: el span cruza roles y se extiende hasta hoy si alguno sigue abierto", () => {
  const anios = aniosDeSkill(view);
  // JavaScript aparece en los cuatro roles; el más viejo arranca en 2020-04 y
  // Dinkum sigue abierto. Sin `since`, eso es todo el span.
  assert.ok(Math.abs(anios.get("javascript")! - monthsBetween("2020-04", null) / 12) < 0.01);
});

test("aniosDeSkill: un proyecto sin `roleId` igual aporta su propia fecha", () => {
  // `jwd-maderas` no tiene rol. Si el span solo mirara roles, Next.js, Tailwind
  // y Sanity darían 0 años teniendo 5 conexiones cada una — parecería un bug.
  const anios = aniosDeSkill(view);
  for (const id of ["nextjs", "tailwind", "sanity"]) {
    assert.ok(anios.get(id)! > 0, `${id} quedó en 0 años teniendo evidencia con fecha`);
  }
});

test("aniosDeSkill: sin evidencia con fecha y sin `periods`, cero", () => {
  const anios = aniosDeSkill(view);
  const huerfanas = graph.nodes.filter((n) => n.kind === "skill" && n.degree === 0);
  assert.ok(huerfanas.length > 0, "el dataset ya no tiene skills sin evidencia: revisar el test");
  for (const n of huerfanas) {
    assert.equal(anios.get(n.id.replace("skill:", ""))!, 0, `${n.id} inventó años sin evidencia`);
  }
});

test("peso = años × grado, y solo para las skills", () => {
  for (const n of graph.nodes) {
    if (n.kind === "skill") assert.ok(Math.abs(n.peso - n.anios * n.degree) < 1e-9, `peso mal en ${n.id}`);
    else assert.equal(n.peso, 0, `${n.id} no es skill y tiene peso`);
  }
});

test("escalaRadio vive en su rango, y es exactamente 1 fuera de las skills", () => {
  for (const n of graph.nodes) {
    if (n.kind !== "skill") {
      assert.equal(n.escalaRadio, 1, `${n.id} no es skill: su radio lo manda el tipo, no la fórmula`);
      continue;
    }
    assert.ok(
      n.escalaRadio >= ESCALA_RADIO_MIN && n.escalaRadio <= ESCALA_RADIO_MAX,
      `${n.id} fuera de rango: ${n.escalaRadio}`,
    );
  }
});

test("el radio va por raíz del peso, no lineal", () => {
  // Es lo que hace que el ÁREA codifique el peso. Con radio lineal, una skill
  // con 4× el peso ocupa 16× de área y el mapa se vuelve un nodo con satélites.
  const skills = graph.nodes.filter((n) => n.kind === "skill" && n.peso > 0);
  const max = skills.reduce((a, b) => (a.peso > b.peso ? a : b));
  const t = (n: (typeof skills)[number]) =>
    (n.escalaRadio - ESCALA_RADIO_MIN) / (ESCALA_RADIO_MAX - ESCALA_RADIO_MIN);
  for (const n of skills) {
    assert.ok(Math.abs(t(n) - Math.sqrt(n.peso / max.peso)) < 1e-9, `${n.id} no sigue la raíz`);
  }
  assert.equal(t(max), 1, "la skill de mayor peso tiene que llegar al techo");
});

test("la skill más grande es la de más años × conexiones, no la de más grado", () => {
  const skills = graph.nodes.filter((n) => n.kind === "skill");
  const porRadio = [...skills].sort((a, b) => b.escalaRadio - a.escalaRadio)[0]!;
  const porPeso = [...skills].sort((a, b) => b.peso - a.peso)[0]!;
  assert.equal(porRadio.id, porPeso.id);
});

// ---------------------------------------------------------------------------
// LAYOUT RADIAL: roles afuera, tecnologías al centro
// ---------------------------------------------------------------------------

test("los roles quedan por fuera de las skills", () => {
  const { nodes } = layoutGraph(graph);
  const radio = (k: string) => {
    const rs = nodes.filter((n) => n.kind === k && !n.sinEvidencia).map((n) => Math.hypot(n.x, n.y, n.z));
    return rs.reduce((a, b) => a + b, 0) / rs.length;
  };
  const roles = radio("role");
  const skills = radio("skill");
  assert.ok(roles > skills, `roles a ${roles.toFixed(0)} y skills a ${skills.toFixed(0)}: no hay corteza`);
  // Los logros y proyectos son el puente: tienen que quedar en el medio.
  assert.ok(radio("project") < roles, "los proyectos salieron más afuera que los roles");
  assert.ok(radio("skill") < radio("achievement"), "las skills no quedaron adentro de los logros");
});

test("las skills sin evidencia van al núcleo, no al borde", () => {
  const { nodes } = layoutGraph(graph);
  const nucleo = nodes.filter((n) => n.sinEvidencia);
  assert.ok(nucleo.length > 0, "el dataset ya no tiene huérfanas: revisar el test");
  const cuerpo = nodes
    .filter((n) => !n.sinEvidencia)
    .map((n) => Math.hypot(n.x, n.y, n.z))
    .sort((a, b) => a - b);
  const mediana = cuerpo[Math.floor(cuerpo.length / 2)]!;
  for (const n of nucleo) {
    assert.ok(
      Math.hypot(n.x, n.y, n.z) < mediana,
      `${n.id} sin evidencia quedó por fuera de la mediana del cuerpo`,
    );
  }
});

test("el encuadre contiene todo el grafo", () => {
  // La cámara usa `radioEncuadre` para el `dist` inicial y para la niebla. Si
  // un nodo queda afuera, entra al cuadro recortado o directamente no se ve.
  const { nodes, radioEncuadre } = layoutGraph(graph);
  for (const n of nodes) {
    assert.ok(Math.hypot(n.x, n.y, n.z) <= radioEncuadre, `${n.id} quedó fuera del encuadre`);
  }
});

test("ningún nodo se dibuja encima de otro", () => {
  // Es la regresión que trajo el tamaño variable: con radios de 6 a 34, React se
  // comía enteras a las skills chicas que le caían al lado. La repulsión pasó a
  // pesar por tamaño y las huérfanas salieron de la simulación por eso.
  //
  // Radios del 3D, que son los más grandes de los dos renderers: si acá no se
  // pisan, en el `<svg>` tampoco.
  const R: Record<string, number> = { role: 17, project: 14, skill: 10, achievement: 9 };
  const { nodes } = layoutGraph(graph);
  const radio = (n: (typeof nodes)[number]) => R[n.kind]! * n.escalaRadio;

  const solapes: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let k = i + 1; k < nodes.length; k++) {
      const a = nodes[i]!, b = nodes[k]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      const suma = radio(a) + radio(b);
      if (d < suma) solapes.push(`${a.label}/${b.label} (${(d - suma).toFixed(0)})`);
    }
  }
  assert.deepEqual(solapes, [], `nodos pisados: ${solapes.join(", ")}`);
});
