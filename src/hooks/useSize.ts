import { useLayoutEffect, useRef, useState } from "react";

/** Measures an element's box with a safe, debounced ResizeObserver. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId: number | null = null;
    const update = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        setSize((s) => {
          if (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5) {
            return s;
          }
          return { w: Math.round(r.width), h: Math.round(r.height) };
        });
      });
    };

    update();
    const ro = new ResizeObserver(() => {
      update();
    });

    ro.observe(el);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return { ref, ...size };
}
