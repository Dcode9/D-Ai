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
  backdropOpacity = 0.94,
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
        {/* Subtle radial golden sheen for active / hover states */}
        <radialGradient id={`frame-glow-${reactId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e8d3a0" stopOpacity={active ? 0.22 : 0.08} />
          <stop offset="60%" stopColor="#c9a86a" stopOpacity={active ? 0.1 : 0.03} />
          <stop offset="100%" stopColor="#181716" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* BACK COLORED CONTAINER AREA: 100% boundary-clipped to the exact ornate contour */}
      {showBackdrop && (
        <g clipPath={`url(#frame-clip-${reactId})`}>
          {/* Rich velvety dark glass background */}
          <rect width={w} height={h} fill="#181716" opacity={backdropOpacity} />

          {/* Elegant centered golden sheen */}
          <rect width={w} height={h} fill={`url(#frame-glow-${reactId})`} />

          {/* Subtle noise grain */}
          <rect
            width={w}
            height={h}
            filter="url(#noise)"
            style={{ mixBlendMode: "overlay" }}
            opacity={0.25}
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
