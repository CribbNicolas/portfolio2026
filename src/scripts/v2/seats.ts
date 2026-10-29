// Chapter 4, "Nada se pierde": the seat map, two clicks that race
// each other into the cart, and the queue (AsyncPile) that makes them wait.
//
// The hand-off and the hall's glide are scrubbed. The four beats are NOT:
// each one is a short scene that PLAYS, in time, when the scroll reaches its
// beat (author, 2026-10-28 — scrubbed, the story did not read). Every scene
// starts by setting its own starting state, so it plays the same from either
// direction, and the seats on the map act out what happens in the flow below.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { $, $$, holdScroll, paced, pinPaced, refreshing, releaseScroll } from "./util";
import { GHOST, ghostCenter, mapSites } from "./peak";
import { cellsToSeats } from "./morph";

export function seats() {
  const beats = $$("[data-seat-beat]");
  const rail = $$("[data-seat-rail]");
  const root = $("[data-seats]");
  const all = $$<SVGCircleElement>(".seat", root);
  const picks = $$<SVGCircleElement>("[data-pick]", root).sort((a, b) => Number(a.dataset.pick) - Number(b.dataset.pick));
  const tokens = $$("[data-token]");
  const lost = $("[data-token-lost]");
  const items = $$("[data-cart-item]");
  const sync = $("[data-sync]");
  const syncMap = $("[data-sync-map]");
  const syncCart = $("[data-sync-cart]");
  const laneLabel = $("[data-pile-label]");
  // The two labels that carry words come from the page, per locale.
  const { concurrent, serial } = laneLabel.dataset as { concurrent: string; serial: string };
  const surfaces = $$("[data-surfaces] .surface");
  const count = { map: 0, cart: 0 };

  gsap.set(beats, { autoAlpha: 0, y: 40 });
  gsap.set([...tokens, lost], { autoAlpha: 0, left: "0%" });
  gsap.set(items, { autoAlpha: 0, x: 12 });
  gsap.set("[data-pile-label], [data-surfaces] .surface, [data-cart], [data-sync]", { autoAlpha: 0 });
  gsap.set(picks, { transformOrigin: "50% 50%" });

  // 00 — the hand-off from the map, with ONE hall. Two phases, both pure
  //  functions of scroll, so nothing can drift:
  //  · arrive — while this section slides up over the map's last screen, the
  //    hall is held still at the map's center in the map's pose. Its frame
  //    fades in, dark, and one district per seat flies off the map into it;
  //    each seat lights up as its district lands (morph.ts).
  //  · glide — once pinned, it levels out and glides right into its place.
  //
  // "Held still" is NOT a counter-shift against the scroll any more. That
  // was JS chasing a native scroll one frame late: dragging the scrollbar
  // (the compositor scrolls before JS runs) painted the hall 1 frame off and
  // it flickered. Now, from the hand-off until this chapter's pin ends, the
  // hall lives in a layer FIXED to the screen (`.handoff`), at the exact box
  // it has inside the pinned stage — so no scroll ever moves it.
  const hall = $("[data-hall3d]");
  const stage = $("[data-seats-stage]");
  const section = $("[data-seats]");
  // Where the hall rests, relative to the map's center. Measured with the
  // transform cleared.
  let off = { x: 0, y: 0 };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const glide = gsap.parseEase("power3.inOut");
  const fly = { p: 0 };
  const apply = () => {
    const t = glide(fly.p);
    gsap.set(hall, {
      x: lerp(off.x, 0, t),
      y: lerp(off.y, 0, t),
      scale: lerp(GHOST.scale, 1, t),
      rotateX: lerp(GHOST.rotateX, 0, t),
      rotateZ: 0,
    });
  };
  // The fixed layer, and the hall's way in and out of it. The stage fills the
  // screen when pinned, so the hall's box inside the stage IS its box on
  // screen while pinned: that is where it sits in the layer.
  const home = hall.parentElement!;
  const after = hall.nextSibling;
  const layer = document.createElement("div");
  layer.className = "handoff";
  document.body.append(layer);
  let rest = { left: 0, top: 0, width: 0, height: 0 };
  let hosted = false;
  // Holds the hall's place in the column while it is away in the layer —
  // without it the cart and the lane moved up under the hall.
  const spacer = document.createElement("div");
  const host = (on: boolean) => {
    if (on === hosted) return;
    hosted = on;
    if (on) {
      spacer.style.height = `${rest.height}px`;
      home.insertBefore(spacer, hall);
      layer.append(hall);
      Object.assign(hall.style, {
        position: "absolute",
        left: `${rest.left}px`,
        top: `${rest.top}px`,
        width: `${rest.width}px`,
      });
    } else {
      home.insertBefore(hall, after);
      spacer.remove();
      Object.assign(hall.style, { position: "", left: "", top: "", width: "" });
    }
  };
  const measure = () => {
    const was = hosted;
    host(false);
    gsap.set(hall, { clearProps: "transform" });
    const h = hall.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    rest = { left: h.left - st.left, top: h.top - st.top, width: h.width, height: h.height };
    const c = ghostCenter();
    off = {
      x: c.x - (rest.left + h.width / 2),
      y: c.y - (rest.top + h.height / 2),
    };
    host(was);
    apply();
  };
  measure();
  addEventListener("resize", measure);

  gsap.set([".lane", "[data-seats] .rail", "[data-seats] .chapter__note"], { autoAlpha: 0 });
  gsap.set(hall, { autoAlpha: 0 });
  gsap.set(stage, { "--scrim": 0 });
  const fill = gsap
    .timeline({ paused: true })
    .fromTo(hall, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: "none" }, 0.2);
  const morph = cellsToSeats(mapSites(all.length), all);
  morph.render(0);
  // Redrawn every frame while the hand-off is under way, not only when the
  // scroll moves: both ends ease after the scroll (the pins' scrub), and a
  // canvas drawn once at the last scroll event left its points behind.
  let handoff = 0;
  gsap.ticker.add(() => {
    if (handoff > 0 && handoff < 1) morph.render(handoff);
  });
  ScrollTrigger.create({
    trigger: section,
    start: "top bottom",
    end: "top top",
    onUpdate: (self) => {
      handoff = self.progress;
      fill.progress(handoff);
    },
    onLeave: () => ((handoff = 1), fill.progress(1), morph.render(1)),
    onLeaveBack: () => ((handoff = 0), fill.progress(0), morph.render(0)),
  });

  const descent = gsap.timeline({ defaults: { ease: "none" } });
  descent
    .to(fly, { p: 1, duration: 1.4, onUpdate: apply }, 0.1)
    .to("[data-seats] .rail, [data-seats] .chapter__note", { autoAlpha: 1, duration: 0.3 }, 1.2)
    .to(stage, { "--scrim": 1, duration: 0.5 }, 0.9);

  // --- the four scenes ------------------------------------------------------
  const show = () => {
    syncMap.textContent = String(Math.round(count.map));
    syncCart.textContent = String(Math.round(count.cart));
  };
  type SeatState = "" | "pending" | "picked" | "error";
  const seat = (tl: gsap.core.Timeline, i: number, state: SeatState, at: number) =>
    tl.set(picks[i], { attr: { class: state ? `seat seat--${state}` : "seat" } }, at);
  // A seat that changes state on the map takes a small bounce, so the eye
  // goes from the flow below back up to the map.
  const pop = (tl: gsap.core.Timeline, i: number, at: number) =>
    tl.fromTo(picks[i], { scale: 1.7 }, { scale: 1, duration: 0.35, ease: "back.out(2)" }, at);
  const counts = (tl: gsap.core.Timeline, map: number, cart: number, at: number, duration = 0.2) =>
    tl.to(count, { map, cart, duration, ease: "none", onUpdate: show }, at);
  const verdict = (tl: gsap.core.Timeline, state: "" | "bad" | "ok", at: number) =>
    tl.call(
      () => {
        sync.classList.toggle("is-bad", state === "bad");
        sync.classList.toggle("is-ok", state === "ok");
      },
      [],
      at,
    );
  // Each scene opens on a known state, whatever played before it.
  const reset = (tl: gsap.core.Timeline, o: { seats: SeatState; cart: number; map: number; label: string }) => {
    picks.forEach((_, i) => seat(tl, i, o.seats, 0));
    tl.set(picks, { scale: 1 }, 0);
    tl.set([...tokens, lost], { autoAlpha: 0, left: "0%", y: 0, rotate: 0 }, 0);
    items.forEach((it, i) => tl.set(it, { autoAlpha: i < o.cart ? 1 : 0, x: i < o.cart ? 0 : 12 }, 0));
    tl.set(count, { map: o.map, cart: o.cart }, 0);
    tl.call(show, [], 0);
    verdict(tl, o.map > 0 && o.map === o.cart ? "ok" : "", 0);
    tl.call(() => void (laneLabel.textContent = o.label), [], 0);
    tl.set(laneLabel, { autoAlpha: 1 }, 0);
    tl.set(surfaces, { autoAlpha: 0, y: 12 }, 0);
    tl.set("[data-cart], [data-sync], .lane", { autoAlpha: 1 }, 0);
  };
  const ARRIVE = "86%";

  const scenes: (() => gsap.core.Timeline)[] = [
    // 01 — the brief: the plugin is the bridge. A seat picked on the map
    // travels to the WooCommerce cart; map and cart agree.
    () => {
      const tl = gsap.timeline();
      reset(tl, { seats: "", cart: 0, map: 0, label: "Store API" });
      picks.forEach((_, i) => {
        const t = 0.35 + i * 0.7;
        seat(tl, i, "picked", t);
        pop(tl, i, t);
        counts(tl, i + 1, i, t, 0.05);
        tl.set(tokens[i], { autoAlpha: 1, left: "0%" }, t + 0.1);
        tl.to(tokens[i], { left: ARRIVE, duration: 0.45, ease: "power2.inOut" }, t + 0.1);
        tl.to(tokens[i], { autoAlpha: 0, duration: 0.1 }, t + 0.55);
        tl.to(items[i], { autoAlpha: 1, x: 0, duration: 0.2 }, t + 0.55);
        counts(tl, i + 1, i + 1, t + 0.55, 0.05);
      });
      verdict(tl, "ok", 3.3);
      return tl;
    },

    // 02 — what broke: four clicks in a row, four requests in flight at
    // once. The nonce rotates under them, one is lost, and the map ends up
    // saying 4 while the cart says 3: the lost seat turns red on the map.
    () => {
      const tl = gsap.timeline();
      reset(tl, { seats: "", cart: 0, map: 0, label: `Store API · ${concurrent}` });
      picks.forEach((_, i) => {
        const t = 0.35 + i * 0.12;
        seat(tl, i, "pending", t);
        pop(tl, i, t);
        counts(tl, i + 1, 0, t, 0.05);
        tl.set(tokens[i], { autoAlpha: 1, left: "0%", y: (i - 1.5) * 9 }, t + 0.05);
      });
      picks.forEach((_, i) => {
        const t = 0.45 + i * 0.12;
        if (i === 2) {
          tl.to(tokens[i], { left: "45%", duration: 0.55, ease: "power1.in" }, t);
          tl.set(tokens[i], { autoAlpha: 0 }, t + 0.55);
          tl.set(lost, { autoAlpha: 1, left: "45%", y: 0 }, t + 0.55);
          tl.to(lost, { y: 46, rotate: 12, autoAlpha: 0, duration: 0.8, ease: "power2.in" }, t + 1.0);
          seat(tl, i, "error", t + 0.6);
          tl.fromTo(picks[i], { scale: 1 }, { keyframes: { scale: [1, 1.6, 1, 1.6, 1] }, duration: 0.9 }, t + 0.6);
        } else {
          tl.to(tokens[i], { left: ARRIVE, duration: 0.9, ease: "power1.inOut" }, t);
          tl.to(tokens[i], { autoAlpha: 0, duration: 0.1 }, t + 0.9);
          tl.to(items[i], { autoAlpha: 1, x: 0, duration: 0.2 }, t + 0.9);
          seat(tl, i, "picked", t + 0.9);
          counts(tl, 4, i < 2 ? i + 1 : i, t + 0.9, 0.05);
        }
      });
      verdict(tl, "bad", 1.75);
      return tl;
    },

    // 03 — the decision: the same four clicks, queued. AsyncPile sends one,
    // waits for it, then the next; each seat is confirmed on the map only
    // when its line is in the cart.
    () => {
      const tl = gsap.timeline();
      reset(tl, { seats: "pending", cart: 0, map: 4, label: `AsyncPile · ${serial}` });
      const SLOT = 13;
      tokens.forEach((t, i) => tl.set(t, { autoAlpha: 1, left: `${(3 - i) * SLOT}%`, y: 0 }, 0.2));
      tokens.forEach((t, i) => {
        const go = 0.6 + i * 0.75;
        tl.to(t, { left: ARRIVE, duration: 0.45, ease: "power2.inOut" }, go);
        tl.to(t, { autoAlpha: 0, duration: 0.1 }, go + 0.45);
        tl.to(items[i], { autoAlpha: 1, x: 0, duration: 0.2 }, go + 0.45);
        seat(tl, i, "picked", go + 0.45);
        pop(tl, i, go + 0.45);
        counts(tl, 4, i + 1, go + 0.45, 0.05);
        // Everyone still waiting moves up one place.
        tokens.slice(i + 1).forEach((w, k) => tl.to(w, { left: `${(2 - i - k) * SLOT + SLOT}%`, duration: 0.3 }, go + 0.1));
      });
      verdict(tl, "ok", 3.6);
      return tl;
    },

    // 04 — the result: reload, minicart and checkout show the same four
    // seats. Each surface that appears lights the four seats on the map.
    () => {
      const tl = gsap.timeline();
      reset(tl, { seats: "picked", cart: 4, map: 4, label: "AsyncPile" });
      surfaces.forEach((sf, i) => {
        const t = 0.3 + i * 0.6;
        tl.to(sf, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" }, t);
        tl.fromTo(picks, { scale: 1.5 }, { scale: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.04 }, t + 0.1);
      });
      return tl;
    },
  ];

  // --- which beat the scroll is on --------------------------------------------
  // The pin still runs a timeline, but only to measure where the reader is:
  // beat k is active from its start until the next one. Changing beat swaps
  // the text and plays that beat's scene.
  const starts = [0, 2.2, 4.8, 7.4];
  const tl: gsap.core.Timeline = gsap.timeline();
  tl.to({}, { duration: 9.8 });
  let active = -1;
  let scene: gsap.core.Timeline | null = null;
  const goTo = (k: number) => {
    if (k === active) return;
    const prev = active;
    active = k;
    scene?.kill();
    scene = null;
    // Only the beat leaving and the beat arriving may be on screen.
    beats.forEach((b, j) => j !== prev && j !== k && gsap.set(b, { autoAlpha: 0, overwrite: true }));
    if (prev >= 0) {
      gsap.to(beats[prev], { autoAlpha: 0, y: k > prev ? -40 : 40, duration: 0.3, ease: "power2.in", overwrite: true });
    }
    rail.forEach((r, j) => r.classList.toggle("on", j <= k));
    if (k < 0) {
      gsap.set("[data-cart], [data-sync], .lane, [data-surfaces] .surface", { autoAlpha: 0 });
      picks.forEach((p) => p.setAttribute("class", "seat"));
      return;
    }
    gsap.fromTo(
      beats[k],
      { autoAlpha: 0, y: k > prev ? 40 : -40 },
      { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", delay: prev >= 0 ? 0.2 : 0, overwrite: true },
    );
    scene = scenes[k]();
  };
  // Where the reader is, in this beat timeline's own clock: negative while
  // the hall is still gliding in. Only RECORDED here: the pin renders this
  // timeline at several times while it refreshes (start, end, back), and
  // acting on each of those started a storm of scenes and left every beat's
  // text on screen at once. The ticker acts on the last answer, once a
  // frame, and never mid-refresh.
  let want = -1;
  function whereAmI() {
    const t = tl.parent ? tl.parent.time() - tl.startTime() : -1;
    want = -1;
    starts.forEach((s, j) => {
      if (t >= s) want = j;
    });
  }
  gsap.ticker.add(() => {
    if (!refreshing.now) goTo(want);
  });

  // Pacing, in screens of scroll per beat. The race (02) and the queue (03)
  // get the most: they are the story. The brief and the result are quicker.
  // --- the switch-off, and the page intercepting the reader -----------------
  // After the last beat, reaching the end of the chapter sets off ONE
  // automatic sequence, with the scroll held from its first frame to its
  // last (author, 2026-10-28): the screen switches off like an old set —
  // black bars close in to a hot line, the line to a dot — and on that black
  // the page does to the reader what DD does to an agent: the dot becomes a
  // cursor and it hands over, in DD's own format, the one thing to know
  // before going on. When it says "Seguí bajando", the scroll is let go.
  // The screen after it is the one the DD chapter rises under, invisible
  // beneath the black (overlap in main.ts).
  const crt = $("[data-crt]");
  const bars = { tb: ".crt__bar--top, .crt__bar--bottom", lr: ".crt__bar--left, .crt__bar--right" };
  const line = $("[data-crt-line]");
  const dot = $("[data-crt-dot]");
  const ddx = $("[data-ddx]");
  const cmd = $("[data-ddx-type]");
  const caret = $("[data-ddx-caret]");
  const said = $$("[data-ddx-l]");
  const mem = $("[data-ddx-mem]");
  const go = $("[data-ddx-go]");
  const cmdText = cmd.textContent ?? "";
  const memText = mem.textContent ?? "";
  gsap.set(ddx, { autoAlpha: 0 });

  let hook: gsap.core.Timeline | null = null;
  /** The screen as it is before the switch-off: nothing of the black. */
  const screenOn = () => {
    hook?.kill();
    hook = null;
    gsap.set(crt, { visibility: "hidden" });
    gsap.set(bars.tb, { scaleY: 0 });
    gsap.set(bars.lr, { scaleX: 0 });
    gsap.set([line, dot], { opacity: 0, scaleX: 1, scale: 1 });
    gsap.set(dot, { clearProps: "boxShadow" });
    gsap.set(ddx, { autoAlpha: 0, y: 0 });
  };
  /** The black with everything said — for a reader coming back up into it. */
  const screenSaid = () => {
    hook?.kill();
    hook = null;
    gsap.set(crt, { visibility: "visible" });
    gsap.set(bars.tb, { scaleY: 1 });
    gsap.set(bars.lr, { scaleX: 1 });
    gsap.set([line, dot], { opacity: 0 });
    gsap.set(ddx, { autoAlpha: 1, y: 0 });
    gsap.set(caret, { x: 0, y: 0, scale: 1, visibility: "visible" });
    cmd.textContent = cmdText;
    mem.textContent = memText;
    gsap.set([...said, mem, go], { opacity: 1 });
  };
  const switchOff = () => {
    screenOn();
    holdScroll();
    // Cleared first, then measured: the caret's home is right after "⏺ ".
    gsap.set(crt, { visibility: "visible" });
    gsap.set(ddx, { autoAlpha: 1 });
    gsap.set([...said, mem, go], { opacity: 0 });
    // Visibility, not opacity: the caret's blink is a CSS animation, which
    // would override an inline opacity.
    gsap.set(caret, { visibility: "hidden" });
    cmd.textContent = "";
    mem.textContent = "";
    const c = caret.getBoundingClientRect();
    const st = { n: 0, m: 0 };
    hook = gsap
      .timeline({ defaults: { ease: "power2.in" }, onComplete: releaseScroll })
      // The switch-off: top and bottom close to a hot line...
      .to(bars.tb, { scaleY: 1, duration: 0.55 }, 0.1)
      .to(line, { opacity: 1, duration: 0.08, ease: "none" }, 0.55)
      // ...the sides close the line to a dot...
      .to(bars.lr, { scaleX: 1, duration: 0.4 }, 0.7)
      .to(line, { scaleX: 0.006, duration: 0.4 }, 0.7)
      .to(dot, { opacity: 1, duration: 0.06, ease: "none" }, 1.0)
      .to(line, { opacity: 0, duration: 0.08, ease: "none" }, 1.06)
      // ...the dot glows once in the dark...
      .to(dot, { keyframes: { scale: [1, 1.5, 1] }, duration: 0.7, ease: "sine.inOut" }, 1.2)
      // ...shrinks into the size of the cursor, and the cursor takes its
      // place in the same frame — the dot (and its glow, which stuck out at
      // the sides) goes out under it — then carries on to the command.
      .to(dot, { scale: 0.45, boxShadow: "0 0 0 0 rgba(0,0,0,0)", duration: 0.12, ease: "power2.in" }, 1.83)
      // Centered on the dot: the middle of the black layer, which (like the
      // page) stops short of the scrollbar's gutter — hence clientWidth.
      .set(caret, { visibility: "visible", x: document.documentElement.clientWidth / 2 - (c.left + c.width / 2), y: innerHeight / 2 - (c.top + c.height / 2), scale: 1.6 }, 1.95)
      .set(dot, { opacity: 0 }, 1.95)
      .to(caret, { x: 0, y: 0, scale: 1, duration: 0.55, ease: "power3.inOut" }, 2.15)
      .to(st, {
        n: cmdText.length,
        duration: cmdText.length * 0.045,
        ease: "none",
        onUpdate: () => void (cmd.textContent = cmdText.slice(0, Math.round(st.n))),
      }, "+=0.2")
      .to(said[0], { opacity: 1, duration: 0.2, ease: "none" }, "+=0.35")
      .to(said[1], { opacity: 1, duration: 0.2, ease: "none" }, "+=0.3")
      .set(mem, { opacity: 1 }, "+=0.25")
      .to(st, {
        m: memText.length,
        duration: memText.length * 0.022,
        ease: "none",
        onUpdate: () => void (mem.textContent = memText.slice(0, Math.round(st.m))),
      })
      .to(go, { opacity: 1, duration: 0.4, ease: "none" }, "+=0.5");
  };

  // The screen after it: the text steps away as the reader scrolls on and
  // the DD chapter rises beneath the black.
  // Read straight off the playhead (switchedOff), not a tween: a fromTo
  // here did not restore the text when the reader came back up into it.
  const afterOff = gsap.timeline();
  afterOff.to({}, { duration: 1 }, 0);

  const master = gsap.timeline({ onUpdate: () => (whereAmI(), switchedOff()) }).add(descent).add(tl).add(afterOff);
  const E = descent.duration();
  const offAt = E + tl.duration();
  // Decided on the ticker, never mid-refresh: a refresh renders the pin's
  // timeline at its end, and acting on that held the scroll at page load.
  // Going down into it, it plays (and holds the scroll); coming back up into
  // it, the black is simply there, already said.
  let isOff = false;
  let wantOff = false;
  function switchedOff() {
    const t = master.time() - offAt;
    wantOff = t >= 0;
    // Past the interception, the text steps away as the reader scrolls on.
    if (wantOff && !hook?.isActive()) {
      const k = Math.min(1, Math.max(0, (t - 0.6) / 0.25));
      gsap.set(ddx, { autoAlpha: 1 - k, y: -24 * k });
    }
  }
  gsap.ticker.add(() => {
    if (refreshing.now || wantOff === isOff) return;
    isOff = wantOff;
    // Played (and the scroll held) only for a reader who is here, going
    // down. Jumping past it — a dragged scrollbar, a link — must not hold
    // the page for a scene that is no longer on screen.
    if (!isOff) screenOn();
    else if (pin.direction < 0 || !pin.isActive) screenSaid();
    else switchOff();
  });
  const outer = paced(master, [
    // 00 the hall glides right. 0.9 until 2026-10-29: almost nothing moved for
    // most of that screen (author: halve the still stretches).
    [E, 0.45],
    [E + 2.2, 0.7], // 01 the brief
    [E + 4.8, 1.0], // 02 what broke
    [E + 7.4, 1.1], // 03 the decision
    [E + tl.duration(), 0.8], // 04 the result
    // After the switch-off, a short stretch: the text steps away and the DD
    // chapter pins (author: it took too much scroll to reach its title).
    // DD's stage is see-through until it pins, so its rising over the last
    // seats beat shows nothing (dd.ts).
    [master.duration(), 0.35], // after the switch-off
  ]);
  const pin = pinPaced("[data-seats]", "[data-seats-stage]", outer);
  // In the fixed layer from the hand-off to the end of the pin: both are
  // stretches where the hall must not move with the scroll. Outside them it
  // goes home and scrolls with its stage like everything else.
  ScrollTrigger.create({
    trigger: section,
    start: "top bottom",
    end: () => pin.end,
    onToggle: (self) => host(self.isActive),
  });
  // The black does NOT go at the hand-off to DD: it stays over it while this
  // pin lets go and DD's takes hold, and dissolves after (dd.ts). Cutting it
  // in that same frame showed a jump and a flicker.
}

export function seatsStill() {
  gsap.set(".seat, [data-hall3d]", { clearProps: "transform,opacity,visibility" });
  $$("[data-pick]").forEach((s) => s.setAttribute("class", "seat seat--picked"));
  $("[data-sync-map]").textContent = "4";
  $("[data-sync-cart]").textContent = "4";
}
