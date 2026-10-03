import { useLayoutEffect, useRef, type RefObject } from "react";

const GLYPHS = "ᚠᚢᚦᚨᚱᚲᛉᛟ◇◆✦⟡⌬∴≋#%&*+=?/<>01";
const rnd = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

type Slot = { node: Text; i: number; orig: string };

/**
 * Glyph "decode" shimmer: the last `tail` visible characters under `root` start as
 * glyphs and resolve to the real text, newest last. Starts on the same frame it is
 * called (use it in a layout effect) and restores the exact text when done.
 */
export function decodeTail(root: HTMLElement, tail = 18, ms = 180): () => void {
  if (reduced()) return () => {};
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n as Text).data.trim()) nodes.push(n as Text);
  }
  const slots: Slot[] = [];
  for (let k = nodes.length - 1; k >= 0 && slots.length < tail; k--) {
    const d = nodes[k].data;
    for (let i = d.length - 1; i >= 0 && slots.length < tail; i--) {
      if (/\s/.test(d[i])) continue;
      slots.push({ node: nodes[k], i, orig: d[i] });
    }
  }
  if (!slots.length) return () => {};
  const written = new Map<Text, { orig: string; cur: string }>();
  for (const s of slots) if (!written.has(s.node)) written.set(s.node, { orig: s.node.data, cur: s.node.data });
  const t0 = performance.now();
  let raf = 0;
  let stopped = false;
  const paint = (p: number) => {
    const byNode = new Map<Text, string[]>();
    slots.forEach((s, d) => {
      const arr = byNode.get(s.node) ?? Array.from(written.get(s.node)!.orig);
      const resolveAt = 1 - (d / slots.length) * 0.65;
      arr[s.i] = p >= resolveAt ? s.orig : rnd();
      byNode.set(s.node, arr);
    });
    byNode.forEach((arr, node) => {
      const w = written.get(node)!;
      if (node.data !== w.cur) return; // React changed it underneath us
      w.cur = arr.join("");
      node.data = w.cur;
    });
  };
  const restore = () => {
    written.forEach((w, node) => {
      if (node.data === w.cur) node.data = w.orig;
    });
  };
  const tick = () => {
    if (stopped) return;
    const p = (performance.now() - t0) / ms;
    if (p >= 1) {
      restore();
      return;
    }
    paint(p);
    raf = requestAnimationFrame(tick);
  };
  paint(0);
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    restore();
  };
}

/** Re-run the tail decode each time `dep` changes while `active`. */
export function useDecodeTail(ref: RefObject<HTMLElement | null>, active: boolean, dep: unknown, tail = 18, ms = 180) {
  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    return decodeTail(ref.current, tail, ms);
  }, [active, dep]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Decode a whole short label once when it mounts or changes. */
export function useDecodeAll(ref: RefObject<HTMLElement | null>, dep: unknown, ms = 320) {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!ref.current) return;
    first.current = false;
    return decodeTail(ref.current, 64, ms);
  }, [dep]); // eslint-disable-line react-hooks/exhaustive-deps
}
