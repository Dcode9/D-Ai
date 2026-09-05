import type { AuraState } from "./Aura";
import { cn } from "../utils/cn";

type Props = { state: AuraState; visible?: boolean };

/** Slow-drifting grainy gradient blobs bleeding in from the edges. */
export function Ambient({ state, visible = true }: Props) {
  const boost = state === "thinking" ? 1.35 : state === "answering" ? 1.2 : 1;
  const blob = (style: React.CSSProperties, color: string, base: number) => (
    <div
      className="ambient-blob transition-opacity duration-1000"
      style={{
        ...style,
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        opacity: Math.min(1, base * boost),
      }}
    />
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000",
        visible ? "opacity-100" : "opacity-0",
      )}
      aria-hidden
    >
      {/* top-right plum */}
      {blob(
        { top: "-6%", right: "-10%", width: 560, height: 560, ["--dx" as string]: "-40px", ["--dy" as string]: "30px", ["--dur" as string]: "26s" },
        "#5f36a0",
        0.55,
      )}
      {/* left amber */}
      {blob(
        { top: "48%", left: "-14%", width: 460, height: 460, ["--dx" as string]: "50px", ["--dy" as string]: "-40px", ["--dur" as string]: "21s", ["--delay" as string]: "-8s" },
        "#c9a04a",
        0.42,
      )}
      {/* left plum below amber */}
      {blob(
        { top: "72%", left: "-8%", width: 380, height: 380, ["--dx" as string]: "30px", ["--dy" as string]: "-60px", ["--dur" as string]: "24s", ["--delay" as string]: "-4s" },
        "#6b3fa0",
        0.45,
      )}
      {/* bottom-right amber + plum */}
      {blob(
        { bottom: "-14%", right: "-4%", width: 420, height: 420, ["--dx" as string]: "-30px", ["--dy" as string]: "-40px", ["--dur" as string]: "19s", ["--delay" as string]: "-12s" },
        "#c9a04a",
        0.45,
      )}
      {blob(
        { bottom: "8%", right: "-12%", width: 480, height: 480, ["--dx" as string]: "-50px", ["--dy" as string]: "20px", ["--dur" as string]: "28s", ["--delay" as string]: "-15s" },
        "#5f36a0",
        0.5,
      )}
      {/* faint vignette */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(0,0,0,.45) 100%)" }}
      />
    </div>
  );
}
