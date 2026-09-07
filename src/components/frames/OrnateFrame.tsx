import { useId, type ReactNode } from "react";
import { useSize } from "../../hooks/useSize";
import { cn } from "../../utils/cn";
import {
  braceRect,
  cartouche,
  cloudRect,
  cornerTicks,
  notchRect,
  ogeeArch,
  rect,
  roundRect,
  scoopRect,
} from "./paths";

export type FrameVariant = "image" | "video" | "code" | "text" | "music";

type Stroke = { d: string; dash?: string; width?: number; opacity?: number; bright?: boolean };

type Geometry = {
  clip: string; // inner shape used for the gradient fill
  strokes: Stroke[];
  dots?: { cx: number; cy: number }[];
};

function build(variant: FrameVariant, w: number, h: number): Geometry {
  const p = 1; // outer inset (stroke half-width)
  const g = 7; // gap between outer and inner lines
  const W = w - 2 * p;
  const H = h - 2 * p;

  switch (variant) {
    case "image": {
      const inner = cloudRect(g - 1, g + 2, w - 2 * (g - 1), h - 2 * (g + 2), 13, 3, 1.35);
      return {
        clip: inner,
        strokes: [
          { d: notchRect(p, p, W, H, 11), opacity: 0.85 },
          { d: inner, bright: true },
        ],
      };
    }
    case "video": {
      const inner = scoopRect(g, g, w - 2 * g, h - 2 * g, 9);
      return {
        clip: inner,
        strokes: [
          { d: notchRect(p, p, W, H, 9), opacity: 0.85 },
          { d: inner, bright: true },
        ],
        dots: [
          { cx: g + 9, cy: g + 9 },
          { cx: w - g - 9, cy: g + 9 },
          { cx: w - g - 9, cy: h - g - 9 },
          { cx: g + 9, cy: h - g - 9 },
        ],
      };
    }
    case "code": {
      const archH = Math.min(h * 0.34, 40);
      const inner = ogeeArch(g, g + 5, w - 2 * g, h - 2 * g - 5, archH * 0.78);
      return {
        clip: inner,
        strokes: [
          { d: ogeeArch(p, p, W, H, archH, 6), opacity: 0.85 },
          { d: inner, bright: true },
        ],
      };
    }
    case "text": {
      const inner = roundRect(g + 2, g + 2, w - 2 * (g + 2), h - 2 * (g + 2), 9);
      return {
        clip: inner,
        strokes: [
          { d: cartouche(p, p, W, H, 17, 5), opacity: 0.9 },
          { d: inner, dash: "1.2 3.2", width: 1.4, bright: true },
        ],
      };
    }
    case "music": {
      const b = 5;
      const inner = braceRect(g, g + b + 1, w - 2 * g, h - 2 * (g + b + 1), 8, b, 24);
      return {
        clip: inner,
        strokes: [
          { d: rect(p, p, W, H), dash: "1.2 3.4", width: 1.4, opacity: 0.9 },
          { d: cornerTicks(p, p, W, H, 9), width: 1.2 },
          { d: inner, bright: true },
        ],
      };
    }
  }
}

type Props = {
  variant: FrameVariant;
  active?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
};

export function OrnateFrame({ variant, active, className, children, onClick }: Props) {
  const { ref, w, h } = useSize<HTMLButtonElement>();
  const id = useId().replace(/:/g, "");
  const ready = w > 0 && h > 0;
  const geo = ready ? build(variant, w, h) : null;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "group relative isolate cursor-pointer select-none outline-none transition-transform duration-300",
        "hover:-translate-y-0.5 focus-visible:-translate-y-0.5",
        className,
      )}
    >
      {geo && (
        <svg
          className={cn(
            "pointer-events-none absolute inset-0 overflow-visible transition-[filter] duration-500",
            active ? "frame-glow" : "group-hover:frame-glow",
          )}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden
        >
          <defs>
            <clipPath id={`clip-${id}`}>
              <path d={geo.clip} />
            </clipPath>
          </defs>

          {/* inner fill: dark plate with grainy gradient blobs */}
          <g clipPath={`url(#clip-${id})`}>
            <rect width={w} height={h} fill="#161514" opacity="0.85" />
            <ellipse
              cx={w * 0.3}
              cy={h * 0.15}
              rx={w * 0.34}
              ry={h * 0.5}
              fill="#6b3fa0"
              filter="url(#blur-12)"
              className={cn("transition-opacity duration-700", active ? "opacity-80" : "opacity-45 group-hover:opacity-70")}
            />
            <ellipse
              cx={w * 0.8}
              cy={h * 0.95}
              rx={w * 0.3}
              ry={h * 0.45}
              fill="#c9a04a"
              filter="url(#blur-12)"
              className={cn("transition-opacity duration-700", active ? "opacity-70" : "opacity-35 group-hover:opacity-60")}
            />
            <rect width={w} height={h} fill="url(#grain-pattern)" style={{ mixBlendMode: "overlay" }} opacity="0.35" />
          </g>

          {geo.strokes.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill="none"
              stroke={s.bright || active ? "url(#gold-stroke-bright)" : "url(#gold-stroke)"}
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

      <span
        className={cn(
          "relative z-10 block font-display text-[30px] leading-none tracking-wide transition-colors duration-300",
          active ? "text-[#fff3d6]" : "text-cream group-hover:text-[#fff3d6]",
        )}
        style={{ textShadow: "0 1px 0 rgba(0,0,0,.6), 0 0 14px rgba(239,227,198,.25)" }}
      >
        {children}
      </span>
    </button>
  );
}
