import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";

export type GradientMode = "idle" | "send" | "think" | "image" | "respond" | "final";

/** Derive the gradient mood from the chat: send pulse, think, image, respond, then a final bloom. */
export function useGradientMode(messages: any[], state: string): GradientMode {
  const [pulse, setPulse] = useState<GradientMode | null>(null);
  const prevBusy = useRef(false);
  const busy = state !== "idle" || messages.some((m) => m?.streaming);
  useEffect(() => {
    let t: number | undefined;
    if (busy && !prevBusy.current) {
      setPulse("send");
      t = window.setTimeout(() => setPulse(null), 750);
    } else if (!busy && prevBusy.current) {
      setPulse("final");
      t = window.setTimeout(() => setPulse(null), 2200);
    }
    prevBusy.current = busy;
    return () => { if (t) window.clearTimeout(t); };
  }, [busy]);
  if (pulse === "send" && busy) return "send";
  if (!busy) return pulse === "final" ? "final" : "idle";
  const last = messages[messages.length - 1];
  const steps: any[] = last?.work?.steps || [];
  if (steps.some((s) => s.type === "image_gen" && s.isLive)) return "image";
  if (last?.role === "assistant" && String(last.content || "").trim().length > 0) return "respond";
  return "think";
}

/** Soft gradient blobs behind the whole app. Colour, speed and glow follow the answer state. */
export function Ambient({ mode, visible = true }: { mode: GradientMode; visible?: boolean }) {
  return (
    <div className={cn("ambient", `ambient--${mode}`, !visible && "ambient--off")} aria-hidden>
      <div className="ambient__blob ambient__blob--a"><div className="ambient__core" /></div>
      <div className="ambient__blob ambient__blob--b"><div className="ambient__core" /></div>
      <div className="ambient__blob ambient__blob--c"><div className="ambient__core" /></div>
      <div className="ambient__vignette" />
    </div>
  );
}
