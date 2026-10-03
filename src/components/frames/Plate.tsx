import { useId, type ReactNode } from "react";
import { useSize } from "../../hooks/useSize";
import { cn } from "../../utils/cn";
import { build, type FrameVariant } from "./OrnateFrame";

type Props = {
  variant?: FrameVariant;
  className?: string;
  children?: ReactNode;
  glow?: boolean;
};

/**
 * Ornate panel: obsidian plate with plum and amber light pools, grain and the
 * scalable gilded border from the frame kit. Sizes itself to its content.
 */
export function Plate({ variant = "text", className, children, glow = false }: Props) {
  const { ref, w, h } = useSize<HTMLDivElement>();
  const id = useId().replace(/:/g, "");
  const geo = w > 0 && h > 0 ? build(variant, w, h) : null;

  return (
    <div ref={ref} className={cn("relative isolate", className)}>
      {geo && (
        <svg
          className={cn("pointer-events-none absolute inset-0 -z-10 overflow-visible", glow && "frame-glow")}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden
        >
          <defs>
            <clipPath id={`pl-${id}`}>
              <path d={geo.clip} />
            </clipPath>
          </defs>
          <g clipPath={`url(#pl-${id})`}>
            <rect width={w} height={h} fill="#12100f" opacity="0.97" />
            <ellipse cx={w * 0.12} cy={0} rx={Math.min(w * 0.5, 170)} ry={Math.min(h * 0.3, 90)} fill="#6b3fa0" filter="url(#blur-24)" opacity="0.32" />
            <ellipse cx={w * 0.9} cy={h} rx={Math.min(w * 0.45, 150)} ry={Math.min(h * 0.25, 70)} fill="#c9a04a" filter="url(#blur-24)" opacity="0.2" />
            <rect width={w} height={h} fill="url(#grain-pattern)" style={{ mixBlendMode: "overlay" }} opacity="0.3" />
          </g>
          {geo.strokes.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill="none"
              stroke={s.bright ? "url(#gold-stroke-bright)" : "url(#gold-stroke)"}
              strokeWidth={s.width ?? 1}
              strokeDasharray={s.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={s.opacity ?? 1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {geo.dots?.map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r="1.4" fill="#e8d3a0" />
          ))}
        </svg>
      )}
      {children}
    </div>
  );
}
