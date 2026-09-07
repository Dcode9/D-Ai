import { useId, useMemo } from "react";
import { buildClosedFramePath, type StretchShape, STRETCH_SHAPES } from "./stretchShapes";
import { cn } from "../../utils/cn";

export interface StretchFrameProps {
  shape: StretchShape | number;
  w: number;
  h: number;
  strokeWidth?: number;
  strokeColor?: string;
  activeStrokeColor?: string;
  active?: boolean;
  glow?: boolean;
  showBackdrop?: boolean;
  backdropOpacity?: number;
  className?: string;
}

export function StretchFrame({
  shape: shapeProp,
  w,
  h,
  strokeWidth = 1.6,
  strokeColor,
  activeStrokeColor,
  active = false,
  glow = false,
  showBackdrop = true,
  backdropOpacity = 0.9,
  className,
}: StretchFrameProps) {
  const reactId = useId().replace(/:/g, "");

  const shape = useMemo(() => {
    if (typeof shapeProp === "number") {
      return STRETCH_SHAPES.find((s) => s.id === shapeProp) ?? STRETCH_SHAPES[0];
    }
    return shapeProp;
  }, [shapeProp]);

  const { outerPath, innerPath } = useMemo(() => {
    if (!w || !h || w <= 0 || h <= 0) return { outerPath: "", innerPath: "" };

    // Cap scale proportionally to height, clamped so caps never exceed 42% width on each side
    const capScale = Math.min(h / shape.viewH, (w * 0.42) / shape.capW);
    const naturalHeight = shape.viewH * capScale;
    const capTop = (h - naturalHeight) / 2;

    const outer = buildClosedFramePath(shape.outer, shape.capW, w, capScale, capTop);
    const inner = buildClosedFramePath(shape.inner, shape.capW, w, capScale, capTop);

    return { outerPath: outer, innerPath: inner };
  }, [shape, w, h]);

  if (!w || !h || w <= 0 || h <= 0 || !outerPath) return null;

  const effectiveStroke = active
    ? activeStrokeColor ?? "url(#gold-stroke-bright)"
    : strokeColor ?? "url(#gold-stroke)";

  return (
    <svg
      className={cn(
        "pointer-events-none absolute inset-0 overflow-visible transition-[filter,opacity] duration-500",
        active || glow ? "drop-shadow-[0_0_14px_rgba(201,168,106,0.45)]" : undefined,
        className,
      )}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
    >
      <defs>
        {/* Exact clipping contour matching the outer boundary of the frame */}
        <clipPath id={`frame-clip-${reactId}`}>
          <path d={outerPath} />
        </clipPath>
      </defs>

      {/* BACK COLORED CONTAINER AREA: 100% boundary-clipped to the exact ornate contour with plum/amber soul */}
      {showBackdrop && (
        <g clipPath={`url(#frame-clip-${reactId})`}>
          {/* Base velvety obsidian plate */}
          <rect width={w} height={h} fill="#161514" opacity={backdropOpacity} />

          {/* Royal Plum ambient glow (drifting from upper-left) */}
          <ellipse
            cx={w * 0.28}
            cy={h * 0.22}
            rx={Math.max(w * 0.35, 120)}
            ry={Math.max(h * 0.65, 45)}
            fill="#6b3fa0"
            filter="url(#blur-12)"
            className="transition-opacity duration-700"
            opacity={active ? 0.85 : 0.52}
          />

          {/* Warm Amber / Gold glow (drifting from lower-right) */}
          <ellipse
            cx={w * 0.78}
            cy={h * 0.85}
            rx={Math.max(w * 0.3, 100)}
            ry={Math.max(h * 0.6, 40)}
            fill="#c9a04a"
            filter="url(#blur-12)"
            className="transition-opacity duration-700"
            opacity={active ? 0.78 : 0.44}
          />

          {/* Third amethyst accent for wider frames (like the message box) */}
          {w > 300 && (
            <ellipse
              cx={w * 0.9}
              cy={h * 0.15}
              rx={w * 0.16}
              ry={h * 0.55}
              fill="#7a49b8"
              filter="url(#blur-24)"
              className="transition-opacity duration-700"
              opacity={active ? 0.7 : 0.38}
            />
          )}

          {/* Fine noise grain overlay for the authentic animated grainy texture */}
          <rect
            width={w}
            height={h}
            filter="url(#noise)"
            style={{ mixBlendMode: "overlay" }}
            opacity={0.35}
          />
        </g>
      )}

      {/* CONTINUOUS OUTER ORNATE FRAME: 0 gaps, 0 disconnections */}
      <path
        d={outerPath}
        fill="none"
        stroke={effectiveStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        shapeRendering="geometricPrecision"
        opacity={active ? 1 : 0.94}
      />

      {/* CONTINUOUS INNER ORNATE FRAME: 0 gaps, 0 disconnections */}
      <path
        d={innerPath}
        fill="none"
        stroke={effectiveStroke}
        strokeWidth={strokeWidth * 0.85}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        shapeRendering="geometricPrecision"
        opacity={active ? 0.95 : 0.78}
      />
    </svg>
  );
}
