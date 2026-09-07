import { cn } from "../utils/cn";

export type AuraState = "idle" | "thinking" | "answering";

type Props = { state: AuraState; size?: number; className?: string; ring?: boolean };

/**
 * Morphing grainy gradient blob. Purple-dominant while thinking,
 * gold-dominant while answering, calm when idle.
 */
export function Aura({ state, size = 56, className, ring = true }: Props) {
  const palette =
    state === "thinking"
      ? { "--c1": "#8a5bc4", "--c2": "#b8892f", "--c3": "#2c1a45" }
      : state === "answering"
        ? { "--c1": "#d4ad5a", "--c2": "#7a49b8", "--c3": "#3a2a12" }
        : { "--c1": "#6b3fa0", "--c2": "#c9a04a", "--c3": "#241a30" };

  return (
    <div
      className={cn("aura", `aura--${state}`, className)}
      style={{ width: size, height: size, ...(palette as React.CSSProperties) }}
      aria-hidden
    >
      <div className="aura__shape">
        <div className="aura__layer aura__layer--a" />
        <div className="aura__layer aura__layer--b" />
        <svg className="aura__grain">
          <rect width="100%" height="100%" fill="url(#grain-pattern)" />
        </svg>
      </div>
      {ring && <div className="aura__ring" />}
    </div>
  );
}
